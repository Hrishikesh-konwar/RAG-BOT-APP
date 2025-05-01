"use client"
import * as React from 'react'
import { Input } from "@/components/ui/input"
import { Button } from '@/components/ui/button'

interface IMessage {
    content?: string;
    role?: 'user' | 'assistant';
}

const ChatComponent: React.FC = () => {
    const [message, setMessage] = React.useState<string>('');
    const [messages, setMessages] = React.useState<IMessage[]>([]);

    const handleChat = async () => {
        setMessages((prev) => [...prev, { role: 'user', content: message }]);
        setMessage("");
        const res = await fetch('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ message }),
        });
        const data = await res.json();
        setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }])
    }

    return (
        <div className="flex flex-col h-screen p-4">
            <div className="flex-grow overflow-y-auto">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'} mb-2`}>
                    <div
                      className={`p-3 rounded-lg max-w-[70%] whitespace-pre-wrap ${
                        msg.role === 'user' ? 'bg-blue-200' : 'bg-gray-200'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

            </div>

            <div className="flex gap-3 mt-auto">
                <Input
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Type your query"
                />
                <Button onClick={handleChat} disabled={!message.trim()} >Send</Button>
            </div>
        </div>
    )
}

export default ChatComponent
