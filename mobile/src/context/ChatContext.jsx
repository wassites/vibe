// TODO: estado global do app
// - mesmo modelo do web (useReducer + WebSocket)
import React, { createContext, useContext } from 'react';
const ChatContext = createContext(null);
export function ChatProvider({ children }) { return <ChatContext.Provider value={{}}>{children}</ChatContext.Provider>; }
export function useChat() { return useContext(ChatContext); }
