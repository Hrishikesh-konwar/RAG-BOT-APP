import type { NextRequest } from "next/server";
import PDFParser from "pdf2json";
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

const indexName = process.env.PINECONE_INDEX_NAME || "rag-chatbot";

type TextChunk = {
  id: string;
  text: string;
  pageNumber: number;
  embedding?: number[];
  metadata?: {
    pageNumber: number;
    pdfName: string;
    chunkIndex: number;
  };
};

export const POST = async (request: NextRequest) => {
  const formData = await request.formData();
  const pdfFile = formData.get("pdf") as File;
  const cleanDb = formData.get("cleanDb") === "true";
  if (!pdfFile || !pdfFile.name.endsWith(".pdf")) {
    return new Response(JSON.stringify({ error: "Please upload a valid PDF file" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const documentId = `pdf_${Date.now()}_${pdfFile.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
    if (cleanDb) {
      const index = pinecone.Index(indexName);
      try {
        const deleteResponse = await index.deleteMany({ });
        return deleteResponse;
      } catch (error) {
        console.error("Error deleting all vectors from Pinecone:", error);
        return { error: (error as Error).message };
      }
    }

    const result = await processPdfAndUploadToPinecone(pdfFile, documentId);

    return new Response(JSON.stringify({
      success: true,
      documentId,
      totalChunks: result.totalChunks,
      pineconeResponse: result.pineconeResponse
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing PDF:", error);
    return new Response(JSON.stringify({
      error: "Error processing PDF",
      message: (error as Error).message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

const processPdfAndUploadToPinecone = async (pdfFile: File, documentId: string) => {
  return new Promise<{ totalChunks: number, pineconeResponse: any[] }>(async (resolve, reject) => {
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const pdfParser = new PDFParser();
      const allChunks: TextChunk[] = [];

      pdfParser.on("pdfParser_dataError", (errData: any) => {
        console.error("❌ PDF parsing failed (pdf2json):", errData);
        reject(new Error(
          "This PDF could not be parsed. It might be corrupted or generated using an unsupported format. Please upload a valid PDF."
        ));
      });

      pdfParser.on("pdfParser_dataReady", async (pdfData: any) => {
        try {
          for (let i = 0; i < pdfData.Pages.length; i++) {
            const pageNumber = i + 1;
            const page = pdfData.Pages[i];
            let pageText = "";

            if (page.Texts?.length > 0) {
              for (const textItem of page.Texts) {
                if (textItem.R?.length > 0) {
                  for (const r of textItem.R) {
                    if (r.T) {
                      pageText += decodeURIComponent(r.T) + " ";
                    }
                  }
                }
              }
            }

            const splitter = new RecursiveCharacterTextSplitter({
              chunkSize: 500,
              chunkOverlap: 10,
            });

            const splitDocs = await splitter.createDocuments([pageText]);
            splitDocs.forEach((doc) => {
              allChunks.push({
                id: `${documentId}_chunk_${allChunks.length}`,
                text: doc.pageContent,
                pageNumber,
                metadata: {
                  pageNumber,
                  pdfName: pdfFile.name,
                  chunkIndex: allChunks.length,
                }
              });
            });
          }
          const vectors = await createEmbeddings(allChunks.map(chunk => chunk.text));
          const pineconeResponse = await uploadToPinecone(allChunks, vectors);
          resolve({
            totalChunks: allChunks.length,
            pineconeResponse
          });
        } catch (error) {
          reject(error);
        }
      });
      pdfParser.parseBuffer(buffer);
    } catch (error) {
      reject(error);
    }
  });
};

const createEmbeddings = async (texts: string[]) => {
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
  });
  return await embeddings.embedDocuments(texts);
};

const uploadToPinecone = async (chunks: TextChunk[], vectors: number[][]) => {
  const index = pinecone.Index(indexName);
  const batchSize = 100;
  const responses: any[] = [];
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize).map((chunk, j) => ({
      id: chunk.id,
      values: vectors[i + j],
      metadata: {
        ...chunk.metadata,
        chunkText: chunk.text,
      },
    }));
    
    const response = await index.upsert(batch);
    responses.push(response ?? { batchStart: i, upsertedCount: batch.length });
  }
  return responses;
};

export const config = {
  api: {
    bodyParser: false,
  },
};