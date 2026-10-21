package constants

// NotFoundAnswer is the exact text the RAG pipeline returns when the indexed
// documents cannot answer a question.
//
// The dashboard counts assistant messages equal to this string to derive the
// answer rate, so it MUST stay byte-identical to NOT_FOUND in
// chats-service/app/helpers/rag_graph.py. Changing one without the other
// silently reports a 100% answer rate.
const NotFoundAnswer = "Not found in the provided documents."
