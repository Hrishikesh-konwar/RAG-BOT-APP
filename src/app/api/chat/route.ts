import { NextRequest } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import OpenAI from "openai";

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
});

const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const userQuery = body.message;
        if (!userQuery) {
            return new Response(JSON.stringify({ error: "Query is required." }), { status: 400 });
        }

        // 1. Embed the user query
        const embedder = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
        });

        const [queryEmbedding] = await embedder.embedDocuments([userQuery]);

        // 2. Query Pinecone for top-k similar chunks
        const pineconeResult = await index.query({
            vector: queryEmbedding,
            topK: 5,
            includeMetadata: true,
        });

        const matchedChunks = pineconeResult.matches
            ?.map((match) => match.metadata?.chunkText || "")
            .filter(Boolean)
            .join("\n\n");

        // 3. Create the chat prompt
        const systemPrompt = `You are an expert assistant. Answer questions based *only* on the provided PDF content below. If the content does not contain the answer, say "I don't know."`;

        const fullPrompt = `
                Content from the PDF:
                ${matchedChunks}
                User question: ${userQuery}
                Answer: `;

        // 4. Get response from OpenAI
        const chatResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: fullPrompt },
              ],              
            temperature: 0.2,
        });

        const answer = chatResponse.choices[0].message.content;
        return new Response(JSON.stringify({ answer }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err: any) {
        console.error("Chat API error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
