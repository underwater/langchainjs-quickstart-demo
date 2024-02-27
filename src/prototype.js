import fs from "node:fs";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { YoutubeLoader } from "langchain/document_loaders/web/youtube";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { ChatPromptTemplate } from "@langchain/core/prompts";

import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

const YOUTUBE_VIDEO_URL = "https://www.youtube.com/watch?v=FZhbJZEgKQ4";

// Load documents ------------------------------------------------------------

console.log("Loading documents...");

const loader = YoutubeLoader.createFromUrl(YOUTUBE_VIDEO_URL, {
  language: "en",
  addVideoInfo: true,
});
const rawDocuments = await loader.load();
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 2000,
  chunkOverlap: 400,
});
const documents = await splitter.splitDocuments(rawDocuments);

// Init models and DB --------------------------------------------------------

console.log("Initializing models and DB...");

const embeddings = new OllamaEmbeddings({ model: "all-minilm:l6-v2" });
const model = new ChatOllama({ model: "llama2" });
const vectorStore = await new FaissStore(embeddings, {});

console.log("Embedding documents...");
vectorStore.addDocuments(documents);

// Run the chain -------------------------------------------------------------

console.log("Running the chain...");

const questionAnsweringPrompt = ChatPromptTemplate.fromMessages([
  ["system", "Answer the user's question based on the sources below:\n\n{context}"],
  ["human", "{input}"],
]);
const combineDocsChain = await createStuffDocumentsChain({
  llm: model,
  prompt: questionAnsweringPrompt,
});
const chain = await createRetrievalChain({
  retriever: vectorStore.asRetriever(),
  combineDocsChain,
});
const stream = await chain.stream({
  input: "What are the news about GPT-4 models?",
});

// Print the result ----------------------------------------------------------

console.log(`Result:\n`);
for await (const chunk of stream) {
  process.stdout.write(chunk.answer ?? "");
}
console.log();
