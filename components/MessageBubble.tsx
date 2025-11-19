import React, { useMemo } from 'react';
import { Message, Role } from '../types';
import { Brain, AlertCircle, FileText, Image as ImageIcon } from 'lucide-react';
import { marked } from 'marked';

// Configure marked to handle line breaks like a chat (Github Flavored Markdown + Breaks)
marked.use({
    breaks: true,
    gfm: true
});

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  // Render Markdown for model messages
  const htmlContent = useMemo(() => {
    if (isUser) return message.content;
    try {
      return marked.parse(message.content);
    } catch (e) {
      return message.content;
    }
  }, [message.content, isUser]);

  return (
    <div className={`flex w-full mb-6 animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        {!isUser && (
          <div className="flex-shrink-0 mt-1">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-900/20">
              <Brain size={18} />
            </div>
          </div>
        )}

        {/* Content */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Name Label */}
          {!isUser && <span className="text-xs font-medium text-cortex-text mb-1 ml-1">Cortex</span>}
          
          <div className={`px-5 py-3.5 shadow-sm ${
            isUser 
              ? 'bg-cortex-surfaceAlt rounded-[20px] rounded-tr-sm text-cortex-text' 
              : message.isError 
                ? 'bg-red-900/20 border border-red-800 text-red-200 rounded-lg' 
                : 'bg-transparent text-cortex-text pl-0 pt-0 w-full' 
          }`}>
            
            {/* Attachments Display */}
            {message.attachments && message.attachments.length > 0 && (
                <div className={`flex flex-wrap gap-2 mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {message.attachments.map((att) => (
                        <div key={att.id} className="overflow-hidden rounded-lg border border-cortex-border bg-cortex-surface/50">
                            {att.type === 'image' ? (
                                <img 
                                    src={`data:${att.mimeType};base64,${att.data}`} 
                                    alt={att.name} 
                                    className="max-w-[200px] max-h-[200px] object-cover"
                                />
                            ) : (
                                <div className="flex items-center gap-2 p-3 max-w-[200px]">
                                    <div className="p-2 bg-red-500/20 rounded text-red-400">
                                        <FileText size={20} />
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-xs font-medium truncate w-full text-cortex-text">{att.name}</span>
                                        <span className="text-[10px] text-cortex-subtext uppercase">{att.mimeType.split('/')[1] || 'FILE'}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {message.isError ? (
              <div className="flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{message.content}</span>
              </div>
            ) : (
              <div className="leading-7 text-[15px] md:text-[16px] font-normal tracking-wide">
                {isUser ? (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                ) : (
                    <div 
                        className="markdown-body"
                        dangerouslySetInnerHTML={{ __html: htmlContent as string }} 
                    />
                )}
                
                {message.groundingSources && message.groundingSources.length > 0 && (
                  <div className="mt-4 pt-2 border-t border-cortex-border/50">
                    <p className="text-xs text-cortex-subtext mb-2">Sources</p>
                    <div className="flex flex-wrap gap-2">
                      {message.groundingSources.map((source, idx) => (
                        <a 
                          key={idx} 
                          href={source.uri} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="grounding-chip"
                        >
                          <span className="truncate max-w-[150px]">{source.title || source.uri}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {message.isStreaming && (
                  <span className="inline-block w-2 h-2 ml-1 bg-cortex-text rounded-full animate-pulse"></span>
                )}
              </div>
            )}
          </div>
          
          {/* Footer: Timestamp & Latency */}
          <div className={`flex items-center gap-3 text-[10px] text-cortex-subtext mt-1 px-1 ${isUser ? 'mr-1 flex-row-reverse' : 'ml-0'}`}>
            <span>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {!isUser && message.latency && !message.isStreaming && (
                <span className="bg-cortex-surface px-1.5 py-0.5 rounded text-cortex-subtext opacity-70">
                    {message.modelUsed?.includes('flash') ? 'Flash' : 'Pro'} • {(message.latency / 1000).toFixed(1)}s
                </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};