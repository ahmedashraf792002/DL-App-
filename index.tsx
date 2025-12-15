import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// --- Global Declarations ---
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

// --- Types & Interfaces ---
type Mode = "chat" | "imagine" | "live" | "motion";
type Persona = "general" | "dl_tutor";

interface Message {
  id: string;
  role: "user" | "model";
  text?: string;
  attachment?: {
    data: string; // base64
    mimeType: string;
    name?: string;
  };
  isThinking?: boolean;
}

// --- Icons ---
const Icons = {
  Chat: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>,
  Image: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>,
  Mic: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>,
  Video: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"></path><rect x="2" y="6" width="14" height="12" rx="2" ry="2"></rect></svg>,
  Send: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>,
  Loader: () => <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>,
  Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Book: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
  X: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  Speaker: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>,
  Stop: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>,
  Download: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>,
  File: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
};

const NovaLogo = () => (
  <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="24" fill="#3B82F6"/>
    <path d="M50 25V33" stroke="white" strokeWidth="6" strokeLinecap="round"/>
    <circle cx="50" cy="22" r="6" fill="white"/>
    <rect x="25" y="33" width="50" height="40" rx="14" fill="white"/>
    <circle cx="40" cy="50" r="5" fill="#1E40AF"/>
    <circle cx="60" cy="50" r="5" fill="#1E40AF"/>
    <path d="M42 63C42 63 45 66 50 66C55 66 58 63 58 63" stroke="#1E40AF" strokeWidth="4" strokeLinecap="round"/>
    <path d="M22 45H25V55H22C20.3431 55 19 53.6569 19 52V48C19 46.3431 20.3431 45 22 45Z" fill="white"/>
    <path d="M78 45H75V55H78C79.6569 55 81 53.6569 81 52V48C81 46.3431 79.6569 45 78 45Z" fill="white"/>
  </svg>
);

// --- Helper Functions ---
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Decode audio for TTS
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- Components ---

// 1. Sidebar
const Sidebar = ({ activeMode, setMode }: { activeMode: Mode, setMode: (m: Mode) => void }) => {
  const menuItems: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: "chat", label: "Chat", icon: <Icons.Chat /> },
    { id: "imagine", label: "Imagine", icon: <Icons.Image /> },
    { id: "live", label: "Orion", icon: <Icons.Mic /> },
    { id: "motion", label: "Motion", icon: <Icons.Video /> },
  ];

  return (
    <div style={{
      width: "240px",
      minWidth: "240px",
      backgroundColor: "var(--sidebar-bg)",
      borderRight: "1px solid var(--border-color)",
      display: "flex",
      flexDirection: "column",
      padding: "20px",
      zIndex: 10
    }}>
      <div style={{ marginBottom: "40px", display: 'flex', alignItems: 'center', gap: '12px' }}>
        <NovaLogo />
        <h1 style={{ fontSize: "20px", fontWeight: "700", margin: 0, letterSpacing: "-0.5px" }}>Nova</h1>
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setMode(item.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: activeMode === item.id ? "var(--accent-color)" : "transparent",
              color: activeMode === item.id ? "white" : "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.2s",
              textAlign: "left",
              fontSize: "14px",
              fontWeight: "500",
              outline: "none"
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
      
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "var(--text-secondary)", opacity: 0.6 }}>
        <span style={{ fontSize: "11px" }}>Ahmed Ashraf</span>
      </div>
    </div>
  );
};

// 2. Chat View
const ChatView = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "model", text: "Hello! I'm Nova. Select a persona below to get started." }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachment, setAttachment] = useState<{data: string, mimeType: string, name: string} | null>(null);
  const [persona, setPersona] = useState<Persona>("general");
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (currentSourceRef.current) {
        currentSourceRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await blobToBase64(file);
      setAttachment({ data: base64, mimeType: file.type, name: file.name });
    }
  };

  const playTextToSpeech = async (messageId: string, text: string) => {
    if (playingMessageId === messageId) {
      // Stop playing
      if (currentSourceRef.current) {
        currentSourceRef.current.stop();
        currentSourceRef.current = null;
      }
      setPlayingMessageId(null);
      return;
    }

    // Stop any currently playing
    if (currentSourceRef.current) {
      currentSourceRef.current.stop();
    }
    setPlayingMessageId(messageId);

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      } else if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Generate speech
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("No audio data returned");

      const audioBuffer = await decodeAudioData(
        base64ToUint8Array(base64Audio),
        audioContextRef.current,
        24000,
        1
      );

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setPlayingMessageId(null);
      source.start();
      currentSourceRef.current = source;

    } catch (error) {
      console.error("TTS Error:", error);
      setPlayingMessageId(null);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isLoading) return;

    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: "user", 
      text: input, 
      attachment: attachment ? { ...attachment } : undefined
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setAttachment(null);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const systemInstruction = persona === "dl_tutor" 
        ? "You are an expert AI tutor specializing in Deep Learning. You strictly follow the teaching style, philosophy, and technical stack of 'Deep Learning with Python, 3rd Edition' by François Chollet. You prefer Keras 3 (multi-backend), JAX/TensorFlow/PyTorch, and focus on modern best practices like the Functional API and subclassing."
        : "You are a helpful AI assistant.";

      // Build history excluding the local placeholder "Hello" message (id: "1")
      // and ensuring structure matches Content
      const history = messages
        .filter(m => m.id !== "1") // Skip initial placeholder
        .map(m => {
          const parts: any[] = [];
          if (m.attachment) {
            parts.push({ inlineData: { mimeType: m.attachment.mimeType, data: m.attachment.data } });
          }
          if (m.text) {
             parts.push({ text: m.text });
          }
          return { role: m.role, parts };
        });

      const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        config: { systemInstruction },
        history: history
      });
      
      // Determine message parameter
      let messageParam: any;
      if (userMsg.attachment) {
         // Multimodal: Must pass an array of parts
         const parts = [];
         parts.push({ inlineData: { mimeType: userMsg.attachment.mimeType, data: userMsg.attachment.data } });
         if (userMsg.text) parts.push({ text: userMsg.text });
         messageParam = parts;
      } else {
         // Text only: Pass string directly
         messageParam = userMsg.text || "";
      }

      const resultStream = await chat.sendMessageStream({
        message: messageParam
      });

      let fullText = "";
      const modelMsgId = (Date.now() + 1).toString();
      
      setMessages(prev => [...prev, { id: modelMsgId, role: "model", text: "", isThinking: true }]);

      for await (const chunk of resultStream) {
        // @ts-ignore
        const text = chunk.text; 
        if (text) {
          fullText += text;
          setMessages(prev => prev.map(m => 
            m.id === modelMsgId ? { ...m, text: fullText, isThinking: false } : m
          ));
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "model", text: "Sorry, I encountered an error." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      {/* Persona Selector Header */}
      <div className="glass-panel" style={{ 
        padding: "16px 24px", 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        borderBottom: "1px solid var(--border-color)",
        zIndex: 5
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
           <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Persona:</span>
           <div style={{ display: "flex", gap: "8px" }}>
             <button 
               onClick={() => setPersona("general")}
               style={{ 
                 background: persona === "general" ? "var(--card-bg)" : "transparent",
                 border: `1px solid ${persona === "general" ? "var(--accent-color)" : "var(--border-color)"}`,
                 color: persona === "general" ? "white" : "var(--text-secondary)",
                 padding: "6px 12px",
                 borderRadius: "20px",
                 fontSize: "12px",
                 cursor: "pointer"
               }}>
               General
             </button>
             <button 
               onClick={() => setPersona("dl_tutor")}
               style={{ 
                 background: persona === "dl_tutor" ? "var(--card-bg)" : "transparent",
                 border: `1px solid ${persona === "dl_tutor" ? "var(--accent-color)" : "var(--border-color)"}`,
                 color: persona === "dl_tutor" ? "#6366f1" : "var(--text-secondary)",
                 padding: "6px 12px",
                 borderRadius: "20px",
                 fontSize: "12px",
                 cursor: "pointer",
                 display: "flex",
                 alignItems: "center",
                 gap: "6px"
               }}>
               <Icons.Book />
               Deep Learning w/ Python 3rd Ed.
             </button>
           </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ 
            alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "80%",
            display: "flex",
            alignItems: "flex-end",
            gap: "8px",
            flexDirection: msg.role === "user" ? "row-reverse" : "row"
          }}>
             {msg.role === "model" && !msg.isThinking && msg.text && (
                <button 
                  onClick={() => playTextToSpeech(msg.id, msg.text || "")}
                  style={{
                    background: "var(--card-bg)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "50%",
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: playingMessageId === msg.id ? "var(--accent-color)" : "var(--text-secondary)",
                    cursor: "pointer",
                    flexShrink: 0
                  }}
                  title="Read aloud"
                >
                  {playingMessageId === msg.id ? <Icons.Stop /> : <Icons.Speaker />}
                </button>
             )}

            <div style={{ 
              padding: "12px 16px", 
              borderRadius: "12px", 
              backgroundColor: msg.role === "user" ? "var(--accent-color)" : "var(--card-bg)",
              color: "white",
              lineHeight: "1.5",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}>
              {msg.attachment && (
                <div style={{ marginBottom: "8px", borderRadius: "8px", overflow: "hidden" }}>
                  {msg.attachment.mimeType.startsWith('image/') ? (
                    <img src={`data:${msg.attachment.mimeType};base64,${msg.attachment.data}`} alt="User upload" style={{ maxWidth: "100%", display: "block" }} />
                  ) : (
                    <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px", display: "flex", alignItems: "center", gap: "8px", borderRadius: "8px" }}>
                      <Icons.File />
                      <span style={{ fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.attachment.name || "File"}</span>
                    </div>
                  )}
                </div>
              )}
              {msg.text}
              {msg.isThinking && <span className="animate-pulse">...</span>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: "20px" }}>
        {attachment && (
          <div style={{ marginBottom: "10px", display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--card-bg)", padding: "4px 8px", borderRadius: "4px", fontSize: "12px" }}>
             {attachment.mimeType.startsWith('image/') ? (
                <img src={`data:${attachment.mimeType};base64,${attachment.data}`} style={{ width: "20px", height: "20px", objectFit: "cover", borderRadius: "2px" }} />
             ) : (
                <Icons.File />
             )}
            <span style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachment.name || "File attached"}</span>
            <button onClick={() => setAttachment(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex" }}><Icons.X /></button>
          </div>
        )}
        <div className="glass-panel" style={{ 
          display: "flex", 
          gap: "10px", 
          padding: "10px", 
          borderRadius: "12px"
        }}>
          <button 
            onClick={() => fileInputRef.current?.click()}
            style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "8px" }}
          >
            <Icons.Plus />
          </button>
          <input 
            type="file" 
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={persona === "dl_tutor" ? "Ask about Keras 3, layers, or training loops..." : "Type a message..."}
            style={{ 
              flex: 1, 
              background: "transparent", 
              border: "none", 
              color: "white", 
              outline: "none",
              fontSize: "14px"
            }}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || (!input && !attachment)}
            style={{ 
              background: "var(--accent-color)", 
              border: "none", 
              color: "white", 
              padding: "8px", 
              borderRadius: "8px", 
              cursor: "pointer",
              opacity: (isLoading || (!input && !attachment)) ? 0.5 : 1
            }}
          >
            {isLoading ? <Icons.Loader /> : <Icons.Send />}
          </button>
        </div>
      </div>
    </div>
  );
};

// 3. Imagine View
const ImagineView = () => {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [referenceImages, setReferenceImages] = useState<Array<{data: string, mimeType: string}>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (file) {
          const base64 = await blobToBase64(file);
          newImages.push({ data: base64, mimeType: file.type });
        }
      }
      setReferenceImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const generateImage = async () => {
    if (!prompt) return;
    setLoading(true);
    setImage(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const parts: any[] = [];
      referenceImages.forEach(img => {
        parts.push({
            inlineData: {
                data: img.data,
                mimeType: img.mimeType
            }
        });
      });
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts }
      });
      
      // Iterate to find image part
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            setImage(`data:image/png;base64,${part.inlineData.data}`);
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate image");
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    if (image) {
      const a = document.createElement('a');
      a.href = image;
      a.download = `generated-${Date.now()}.png`;
      a.click();
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "40px", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "512px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ 
          width: "100%", 
          aspectRatio: "1", 
          backgroundColor: "var(--card-bg)", 
          borderRadius: "16px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          overflow: "hidden",
          border: "1px solid var(--border-color)",
          position: "relative"
        }}>
          {loading ? (
             <div style={{ color: "var(--accent-color)" }}><Icons.Loader /></div>
          ) : image ? (
            <>
              <img src={image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button 
                onClick={downloadImage}
                style={{ 
                  position: "absolute", 
                  bottom: "16px", 
                  right: "16px", 
                  background: "rgba(0,0,0,0.6)", 
                  backdropFilter: "blur(4px)",
                  color: "white", 
                  border: "none", 
                  borderRadius: "8px", 
                  padding: "8px 12px", 
                  cursor: "pointer", 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "6px",
                  fontSize: "12px"
                }}
              >
                <Icons.Download /> Download
              </button>
            </>
          ) : (
            <span style={{ color: "var(--text-secondary)" }}>Generated image will appear here</span>
          )}
        </div>
        
        {referenceImages.length > 0 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
             {referenceImages.map((img, idx) => (
                <div key={idx} style={{ position: "relative", width: "48px", height: "48px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                   <img src={`data:${img.mimeType};base64,${img.data}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                   <button 
                      onClick={() => removeImage(idx)}
                      style={{ 
                        position: "absolute", 
                        top: 0, 
                        right: 0, 
                        width: "100%", 
                        height: "100%", 
                        background: "rgba(0,0,0,0.4)", 
                        border: "none", 
                        cursor: "pointer", 
                        opacity: 0, 
                        transition: "opacity 0.2s",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = "0"}
                   >
                     <Icons.X />
                   </button>
                </div>
             ))}
          </div>
        )}

        <div className="glass-panel" style={{ display: "flex", gap: "10px", padding: "8px", borderRadius: "12px" }}>
          <button 
            onClick={() => fileInputRef.current?.click()}
            style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "8px" }}
            title="Upload reference images"
          >
            <Icons.Plus />
          </button>
          <input 
            type="file" 
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="image/*"
            multiple
            onChange={handleFileSelect}
          />
          <input 
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={referenceImages.length > 0 ? "Describe how to edit these images..." : "Describe an image..."}
            style={{ flex: 1, background: "transparent", border: "none", color: "white", padding: "8px", outline: "none" }}
            onKeyDown={e => e.key === "Enter" && generateImage()}
          />
          <button 
            onClick={generateImage}
            disabled={loading || !prompt}
            style={{ background: "var(--accent-color)", border: "none", borderRadius: "8px", color: "white", padding: "8px 16px", cursor: "pointer", fontWeight: "500" }}
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
};

// 4. Live View (Audio Only)
const LiveView = () => {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-4), msg]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  const stopSession = async () => {
     addLog("Ending session...");
     
     if (streamRef.current) {
       streamRef.current.getTracks().forEach(track => track.stop());
       streamRef.current = null;
     }

     if (sessionRef.current) {
        try {
            await sessionRef.current.close();
        } catch(e) {
            console.error("Session close error", e);
        }
        sessionRef.current = null;
     }
     
     if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
            try {
              await audioContextRef.current.close();
            } catch (e) { console.error(e); }
        }
        audioContextRef.current = null;
     }
     
     setConnected(false);
     addLog("Session Ended");
  };

  const startSession = async () => {
    try {
      addLog("Initializing Audio...");
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Only request audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const outputContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioContext; // Keep ref to close later if needed

      let nextStartTime = 0;

      // Audio Input
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const l = inputData.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
          int16[i] = inputData[i] * 32768;
        }
        const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
        
        if (sessionRef.current) {
          sessionRef.current.sendRealtimeInput({ 
            media: { mimeType: 'audio/pcm;rate=16000', data: base64 } 
          });
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Connect to Live API
      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: { 
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' }
            }
          },
          inputAudioTranscription: {},
          systemInstruction: `You are Orion, an intelligent AI assistant. 
You are speaking with Ahmed Ashraf, an AI & ML Engineer.
If asked about your name, respond that you are Orion.
If asked who I am, I am Ahmed Ashraf.

Here is Ahmed Ashraf's profile:
- **Education**: Bachelor of Computer Science and Artificial Intelligence, Benha University (2024), GPA 3.76.
- **Experience**: AI & ML Engineer Intern at Electropi and TechnoHacks EduTech.
- **Skills**: Python, C++, Java, TensorFlow, PyTorch, Scikit-learn, NLP (Transformers, LangChain), CV (YOLO, OpenCV), MLOps (MLflow, Docker).
- **Projects**: Alzheimer’s Detection with GenAI, Bone Fracture Classification, ASL Detection, Heart Disease Prediction.
- **Publications**: Papers on Explainable ML for Liver Disease and ML-Based Anomaly Detection in Healthcare.
- **Contact**: ahmedashraf390@gmail.com.
`
        },
        callbacks: {
          onopen: () => {
            setConnected(true);
            addLog("Connected (Audio Only)!");
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Check for voice exit command
            if (msg.serverContent?.inputTranscription?.text) {
                const text = msg.serverContent.inputTranscription.text.toLowerCase().trim();
                // Simple keyword check for exit
                if (text.includes("exit") || text.includes("stop") || text.includes("end call") || text.includes("goodbye") || text.includes("bye") || text.includes("مع السلامة") || text.includes("اقفل")) {
                    await stopSession();
                    return;
                }
            }

            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              const audioBytes = base64ToUint8Array(audioData);
              // Decode PCM 24k
              const int16 = new Int16Array(audioBytes.buffer);
              const float32 = new Float32Array(int16.length);
              for(let i=0; i<int16.length; i++) float32[i] = int16[i] / 32768.0;
              
              const buffer = outputContext.createBuffer(1, float32.length, 24000);
              buffer.getChannelData(0).set(float32);
              
              const src = outputContext.createBufferSource();
              src.buffer = buffer;
              src.connect(outputContext.destination);
              
              const now = outputContext.currentTime;
              const start = Math.max(now, nextStartTime);
              src.start(start);
              nextStartTime = start + buffer.duration;
            }
          },
          onclose: () => {
             setConnected(false);
             addLog("Disconnected");
          },
          onerror: (e) => console.error(e)
        }
      });

      sessionRef.current = session;

    } catch (e) {
      console.error(e);
      addLog("Error starting session");
    }
  };

  return (
    <div style={{ flex: 1, position: "relative", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      
      {/* Visualizer Placeholder */}
      <div style={{ 
          width: "200px", 
          height: "200px", 
          borderRadius: "50%", 
          background: connected ? "radial-gradient(circle, rgba(99,102,241,0.2) 0%, rgba(0,0,0,0) 70%)" : "rgba(255,255,255,0.05)",
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          marginBottom: "40px",
          border: connected ? "1px solid rgba(99,102,241,0.3)" : "none",
          animation: connected ? "pulse 2s infinite" : "none"
      }}>
          <div style={{ color: connected ? "var(--accent-color)" : "var(--text-secondary)" }}>
            <Icons.Mic />
          </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          70% { box-shadow: 0 0 0 20px rgba(99, 102, 241, 0); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
      `}</style>

      <div style={{ textAlign: "center", zIndex: 10 }}>
        {!connected ? (
          <button 
            onClick={startSession}
            style={{ 
              background: "var(--accent-color)", 
              color: "white", 
              border: "none", 
              padding: "16px 32px", 
              borderRadius: "32px", 
              fontSize: "18px",
              cursor: "pointer",
              boxShadow: "0 0 20px rgba(99, 102, 241, 0.5)"
            }}
          >
            Start Audio Session
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
             <span style={{ color: "var(--success)", fontSize: "14px" }}>● Live</span>
             <button 
                onClick={stopSession}
                style={{ background: "#ef4444", color: "white", border: "none", padding: "12px 24px", borderRadius: "24px", cursor: "pointer" }}
             >
                End Call
             </button>
          </div>
        )}
      </div>

      <div style={{ position: "absolute", top: "20px", right: "20px", background: "rgba(0,0,0,0.5)", padding: "10px", borderRadius: "8px", fontSize: "12px", fontFamily: "monospace", color: "#0f0" }}>
        {logs.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
};

// 5. Motion View
const MotionView = () => {
  const [prompt, setPrompt] = useState("");
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const generateVideo = async () => {
    if (!window.aistudio) {
        setStatus("AI Studio Global not found.");
        return;
    }

    try {
      setStatus("Checking API Key...");
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
        // Assume success, re-instantiate GenAI handled by browser env mostly but here we use normal instantiation
        // Since Veo requires paid key, the openSelectKey sets it for the environment context usually.
        // We will create a new instance just in case.
      }
      
      // Note: We use process.env.API_KEY here assuming it gets populated or the browser injects it.
      // If using the browser specific playground flow:
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      setStatus("Generating... (this takes ~1-2 mins)");
      let op = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
      });

      while (!op.done) {
        await new Promise(r => setTimeout(r, 5000));
        setStatus("Polling status...");
        op = await ai.operations.getVideosOperation({ operation: op });
      }

      const uri = op.response?.generatedVideos?.[0]?.video?.uri;
      if (uri) {
        const fetchUri = `${uri}&key=${process.env.API_KEY}`;
        const res = await fetch(fetchUri);
        const blob = await res.blob();
        setVideoUri(URL.createObjectURL(blob));
        setStatus("Done!");
      }
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e.message || "Unknown error"}`);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "40px", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "600px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ 
          width: "100%", 
          aspectRatio: "16/9", 
          backgroundColor: "var(--card-bg)", 
          borderRadius: "16px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          overflow: "hidden",
          border: "1px solid var(--border-color)",
          position: "relative"
        }}>
           {videoUri ? (
             <video src={videoUri} controls style={{ width: "100%", height: "100%" }} />
           ) : (
             <div style={{ color: "var(--text-secondary)", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
               <Icons.Video />
               <span>{status || "Enter a prompt to generate video"}</span>
             </div>
           )}
        </div>

        <div className="glass-panel" style={{ display: "flex", gap: "10px", padding: "8px", borderRadius: "12px" }}>
          <input 
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="A cyberpunk cat driving a neon car..."
            style={{ flex: 1, background: "transparent", border: "none", color: "white", padding: "8px", outline: "none" }}
          />
          <button 
            onClick={generateVideo}
            disabled={!!(status && status !== "Done!" && !status.startsWith("Error")) || !prompt}
            style={{ background: "var(--accent-color)", border: "none", borderRadius: "8px", color: "white", padding: "8px 16px", cursor: "pointer" }}
          >
            Create
          </button>
        </div>
        
        <div style={{ fontSize: "11px", color: "var(--text-secondary)", textAlign: "center" }}>
          Requires paid API key via Google AI Studio. <br/>
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" style={{ color: "var(--text-secondary)" }}>Billing Info</a>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---
const App = () => {
  const [mode, setMode] = useState<Mode>("chat");

  return (
    <>
      <Sidebar activeMode={mode} setMode={setMode} />
      <main style={{ flex: 1, backgroundColor: "var(--bg-color)", position: "relative", overflow: "hidden" }}>
        {mode === "chat" && <ChatView />}
        {mode === "imagine" && <ImagineView />}
        {mode === "live" && <LiveView />}
        {mode === "motion" && <MotionView />}
      </main>
    </>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);