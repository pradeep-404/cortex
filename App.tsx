import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Brain, Menu, Plus, History, Paperclip, X, Square, FileText, MessageSquare } from 'lucide-react';
import { geminiService } from './services/geminiService';
import { Message, Role, ChatSession, ModelId, Attachment } from './types';
import { MessageBubble } from './components/MessageBubble';
import { TypingIndicator } from './components/TypingIndicator';
import { ModelSelector, MODELS } from './components/ModelSelector';
import mammoth from 'mammoth';

const App: React.FC = () => {
  // --- State ---
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('default');
  const [currentModelId, setCurrentModelId] = useState<ModelId>('flash');
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: Role.MODEL,
      content: "Hello, I'm Cortex. How can I help you today?",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- Refs ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stopGenerationRef = useRef<boolean>(false); 

  // --- Effects ---

  useEffect(() => {
    const storedSessions = localStorage.getItem('cortex_sessions');
    if (storedSessions) {
        try {
            const parsed = JSON.parse(storedSessions);
            const hydrated = parsed.map((s: any) => ({
                ...s,
                messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
            }));
            setSessions(hydrated);
        } catch (e) {
            console.error("Failed to load sessions", e);
        }
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
        localStorage.setItem('cortex_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputValue]);

  // --- Handlers ---

  const createNewSession = () => {
    if (messages.length > 1) {
        saveCurrentSession();
    }
    
    const newId = Date.now().toString();
    setCurrentSessionId(newId);
    setMessages([{
        id: 'welcome',
        role: Role.MODEL,
        content: "Hello, I'm Cortex. How can I help you today?",
        timestamp: new Date(),
    }]);
    setAttachments([]); // Clear attachments
    setInputValue(''); // Clear input
    setIsSidebarOpen(false);
  };

  const saveCurrentSession = () => {
     // Don't save empty or welcome-only sessions
     if (messages.length <= 1) return;

     const sessionName = messages.find(m => m.role === Role.USER)?.content.slice(0, 30) || "New Chat";
     
     setSessions(prev => {
         const existingIndex = prev.findIndex(s => s.id === currentSessionId);
         const newSession: ChatSession = {
             id: currentSessionId,
             title: sessionName,
             messages: messages,
             createdAt: Date.now()
         };

         if (existingIndex >= 0) {
             const updated = [...prev];
             updated[existingIndex] = newSession;
             return updated;
         } else {
             return [newSession, ...prev];
         }
     });
  };

  const loadSession = async (session: ChatSession) => {
      if (messages.length > 1 && currentSessionId !== session.id) {
        saveCurrentSession();
      }
      setCurrentSessionId(session.id);
      setMessages(session.messages);
      setAttachments([]); // Clear attachments when switching
      setInputValue('');
      
      // Use the current selected model for continuation
      const config = MODELS[currentModelId];
      await geminiService.startChat(session.messages, config);
      
      setIsSidebarOpen(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0]; 
    
    try {
        let attachment: Attachment;

        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
            const base64 = await fileToBase64(file);
            attachment = {
                id: Date.now().toString(),
                type: file.type.startsWith('image/') ? 'image' : 'file',
                mimeType: file.type,
                data: base64,
                name: file.name,
                isText: false
            };
        } else if (
            file.name.endsWith('.docx') || 
            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.type === 'text/plain'
        ) {
            let textContent = '';
            if (file.type === 'text/plain') {
                textContent = await file.text();
            } else {
                // DOCX via Mammoth
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                textContent = result.value;
            }
            
            attachment = {
                id: Date.now().toString(),
                type: 'file',
                mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                data: textContent,
                name: file.name,
                isText: true
            };
        } else {
            alert("Unsupported file type. Please upload Images, PDF, DOCX, or TXT.");
            return;
        }

        setAttachments(prev => [...prev, attachment]);
    } catch (err) {
        console.error("File processing error", err);
        alert("Failed to process file");
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
      });
  };

  const removeAttachment = (id: string) => {
      setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleStopGeneration = () => {
      stopGenerationRef.current = true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputValue.trim() && attachments.length === 0) || isLoading) return;

    const userText = inputValue.trim();
    const currentAttachments = [...attachments];
    
    setInputValue('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Add User Message
    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      content: userText,
      timestamp: new Date(),
      attachments: currentAttachments
    };

    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);
    stopGenerationRef.current = false;

    const startTime = Date.now();
    const modelConfig = MODELS[currentModelId];

    try {
      // Initialize/Update chat session config before sending
      await geminiService.startChat(messages.filter(m => m.id !== 'welcome'), modelConfig);

      // Placeholder for AI response
      const responseId = (Date.now() + 1).toString();
      const initialBotMessage: Message = {
        id: responseId,
        role: Role.MODEL,
        content: '',
        timestamp: new Date(),
        isStreaming: true,
        modelUsed: currentModelId
      };

      setMessages(prev => [...prev, initialBotMessage]);

      let fullContent = '';
      const groundingChunks: { title: string; uri: string }[] = [];
      
      const stream = geminiService.sendMessageStream(
          userText || (currentAttachments.length ? "Analyze this attachment." : ""),
          currentAttachments,
          modelConfig
      );

      for await (const chunk of stream) {
        if (stopGenerationRef.current) break;
        
        if (chunk.text) {
            fullContent += chunk.text;
        }
        
        // Collect grounding metadata if present (Research mode)
        if (chunk.candidates && chunk.candidates[0]?.groundingMetadata?.groundingChunks) {
            chunk.candidates[0].groundingMetadata.groundingChunks.forEach(c => {
                if (c.web?.uri && c.web?.title) {
                    if(!groundingChunks.find(g => g.uri === c.web?.uri)) {
                        groundingChunks.push({ title: c.web.title, uri: c.web.uri });
                    }
                }
            });
        }

        setMessages(prev => 
          prev.map(msg => 
            msg.id === responseId 
              ? { ...msg, content: fullContent, groundingSources: groundingChunks } 
              : msg
          )
        );
      }

      const endTime = Date.now();
      const latency = endTime - startTime;

      setMessages(prev => 
        prev.map(msg => 
          msg.id === responseId 
            ? { ...msg, isStreaming: false, latency: latency } 
            : msg
        )
      );

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: Role.MODEL,
        content: "I encountered an issue. Please try again later.",
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
      stopGenerationRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-screen bg-cortex-bg text-cortex-text font-sans overflow-hidden selection:bg-cortex-accent/30 selection:text-white">
      
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 fixed md:relative z-30 w-[280px] h-full flex flex-col bg-cortex-bg md:bg-transparent border-r border-cortex-border/50 md:border-0 shadow-2xl md:shadow-none`}>
        <div className="p-4 flex items-center justify-between md:hidden">
            <span className="font-medium text-lg">Menu</span>
            <div onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-cortex-surface rounded-full cursor-pointer">
                <X size={20} className="text-cortex-subtext" />
            </div>
        </div>
        
        <div className="p-3">
             <button 
              onClick={createNewSession}
              className="w-full flex items-center gap-3 px-4 py-3 bg-cortex-surface hover:bg-cortex-surfaceAlt rounded-[15px] text-sm font-medium text-cortex-text transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Plus size={18} className="text-cortex-accent" />
              <span>New chat</span>
            </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
            <div className="text-xs font-bold text-cortex-subtext mb-3 px-3 uppercase tracking-wider">Recent</div>
            <div className="space-y-1">
                {sessions.map(session => (
                    <div 
                        key={session.id}
                        onClick={() => loadSession(session)}
                        className={`group flex items-center gap-3 text-cortex-text text-sm py-2.5 px-3 rounded-full cursor-pointer truncate transition-all ${currentSessionId === session.id ? 'bg-cortex-button/30 text-blue-100 font-medium' : 'hover:bg-cortex-surface text-cortex-subtext hover:text-cortex-text'}`}
                    >
                        <MessageSquare size={14} className={`flex-shrink-0 ${currentSessionId === session.id ? 'text-blue-300' : 'opacity-50 group-hover:opacity-100'}`} />
                        <span className="truncate">{session.title || "Untitled Chat"}</span>
                    </div>
                ))}
            </div>
        </div>
        
        <div className="p-4 border-t border-cortex-border/30 text-xs text-center text-cortex-subtext opacity-50">
            Cortex AI v1.0
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative bg-cortex-bg md:rounded-l-3xl overflow-hidden md:border-l border-cortex-border/30">
        
        {/* Header */}
        <header className="flex items-center justify-between px-4 md:px-8 py-3 z-10 backdrop-blur-md bg-cortex-bg/80 sticky top-0">
            <div className="flex items-center gap-4">
                <button className="md:hidden p-2 -ml-2 text-cortex-subtext hover:text-cortex-text" onClick={() => setIsSidebarOpen(true)}>
                    <Menu size={24} />
                </button>
                
                <ModelSelector currentModelId={currentModelId} onSelect={setCurrentModelId} />
            </div>

            <div className="flex items-center gap-3">
                 {messages.length > 1 && (
                    <button 
                        onClick={() => {
                            if(window.confirm("Clear this conversation?")) {
                                setMessages([]); 
                                createNewSession();
                            }
                        }} 
                        className="p-2 text-cortex-subtext hover:bg-red-900/20 hover:text-red-400 rounded-full transition-colors"
                        title="Clear conversation"
                    >
                        <Trash2 size={18} />
                    </button>
                 )}
                 <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/30 ring-1 ring-white/10">
                    <Brain size={16} />
                </div>
            </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth" id="scrollable-container">
          <div className="max-w-[800px] mx-auto min-h-full flex flex-col py-6">
            
            {/* Welcome State */}
            {messages.length <= 1 && messages[0].id === 'welcome' && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 animate-slide-up text-center">
                <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-3xl mb-8 flex items-center justify-center shadow-2xl shadow-blue-900/40 rotate-3">
                    <Brain size={48} className="text-white" />
                </div>
                <h1 className="text-4xl md:text-5xl font-medium text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 mb-3">
                    Hello, Human.
                </h1>
                <h2 className="text-xl md:text-2xl font-normal text-cortex-subtext mb-12 max-w-md">
                    I'm Cortex. Ready to assist you with reasoning, code, or research.
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-2xl">
                    {[
                        { t: 'Explain quantum physics', i: '⚛️' }, 
                        { t: 'Write a python script', i: '🐍' }, 
                        { t: 'Research Tokyo travel', i: '🗼' }
                    ].map((suggestion, i) => (
                        <button 
                            key={i}
                            onClick={() => {
                                setInputValue(suggestion.t);
                                if(textareaRef.current) textareaRef.current.focus();
                            }}
                            className="text-left p-4 bg-cortex-surface/50 hover:bg-cortex-surfaceAlt border border-cortex-border/50 rounded-xl text-cortex-text text-sm transition-all hover:translate-y-[-2px] group"
                        >
                            <div className="text-lg mb-1 grayscale group-hover:grayscale-0 transition-all">{suggestion.i}</div>
                            <div className="font-medium">{suggestion.t}</div>
                        </button>
                    ))}
                </div>
              </div>
            )}

            {/* Messages List */}
            <div className="flex-1 space-y-2 pb-32">
              {messages.map((msg) => (
                 (msg.id !== 'welcome' || messages.length === 1) &&
                 <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && messages[messages.length - 1]?.role === Role.USER && (
                 <TypingIndicator />
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cortex-bg via-cortex-bg to-transparent pt-12 pb-6 px-4 z-20">
          <div className="max-w-[800px] mx-auto relative">
            
            {/* Attachments Preview */}
            {attachments.length > 0 && (
                <div className="absolute -top-20 left-0 flex gap-2 overflow-x-auto py-2 max-w-full px-1">
                    {attachments.map((att) => (
                        <div key={att.id} className="relative group animate-fade-in">
                            {att.type === 'image' ? (
                                <img src={`data:${att.mimeType};base64,${att.data}`} alt="Preview" className="h-16 w-16 object-cover rounded-xl border border-cortex-border/50 shadow-lg" />
                            ) : (
                                <div className="h-16 w-16 bg-cortex-surface border border-cortex-border rounded-xl flex flex-col items-center justify-center gap-1 text-cortex-subtext shadow-lg">
                                    <FileText size={20} />
                                    <span className="text-[8px] uppercase truncate w-14 text-center font-mono">{att.mimeType.split('/')[1]?.slice(0, 4) || 'FILE'}</span>
                                </div>
                            )}
                            <button 
                                onClick={() => removeAttachment(att.id)}
                                className="absolute -top-2 -right-2 bg-cortex-surfaceAlt text-cortex-text rounded-full p-1 border border-cortex-border shadow-md hover:bg-red-500 hover:text-white transition-colors"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className={`relative flex flex-col bg-cortex-surface rounded-[26px] border transition-all duration-200 shadow-lg ${isLoading ? 'border-cortex-border/50' : 'border-cortex-border focus-within:border-cortex-accent/50 focus-within:ring-1 focus-within:ring-cortex-accent/20'}`}>
              
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Cortex..."
                rows={1}
                className="w-full bg-transparent border-0 text-cortex-text placeholder-cortex-subtext/70 focus:ring-0 resize-none py-4 pl-12 pr-14 max-h-48 overflow-y-auto rounded-[26px] leading-relaxed"
                style={{ minHeight: '56px' }}
              />

              {/* File Upload Button */}
              <div className="absolute left-3 bottom-3">
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-cortex-subtext hover:text-cortex-text hover:bg-cortex-surfaceAlt rounded-full transition-all active:scale-95"
                    title="Attach file"
                 >
                    <Paperclip size={20} />
                 </button>
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect}
                    accept="image/*,application/pdf,.docx,text/plain" 
                    className="hidden" 
                 />
              </div>

              {/* Send / Stop Button */}
              <div className="absolute right-2 bottom-2 flex items-center">
                 {isLoading ? (
                     <button
                        onClick={handleStopGeneration}
                        className="p-2 rounded-full flex-shrink-0 text-white bg-cortex-text hover:bg-white hover:scale-105 transition-all duration-200 shadow-sm"
                        title="Stop generation"
                     >
                        <Square size={14} fill="currentColor" />
                     </button>
                 ) : (
                    <button
                        onClick={() => handleSubmit()}
                        disabled={(!inputValue.trim() && attachments.length === 0) || isLoading}
                        className={`p-2 rounded-full flex-shrink-0 transition-all duration-200 ${
                            (inputValue.trim() || attachments.length > 0) && !isLoading
                            ? 'text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20 hover:scale-105 transform'
                            : 'text-cortex-subtext bg-transparent cursor-not-allowed opacity-50'
                        }`}
                    >
                        <Send size={18} />
                    </button>
                 )}
              </div>
            </div>
            <p className="text-center text-[10px] text-cortex-subtext/60 mt-3 font-medium tracking-wide">
              Cortex can make mistakes. Review generated responses.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;