import type { IRNodeId } from "@kalphq/sdk";
import { createHash } from "crypto";

/**
 * Generador de IDs ESTABLES basado en hash del contenido semántico.
 *
 * FIX: IDs estables (no posicionales)
 * - MISMO CONTENIDO → MISMO ID (determinístico)
 * - NO depende del orden de compilación
 * - Cacheable, diffable, replayable
 */
export const createIdGenerator = (handlerName: string) => {
  let index = 0;

  /**
   * Genera un ID estable (hash SHA-256 truncado a 12 chars)
   *
   * @param type - tipo de nodo (run, llm_classify, etc.)
   * @param content - contenido adicional para diferenciar nodos del mismo tipo
   * @returns ID estable único
   */
  return (type: string, content?: string): IRNodeId => {
    const currentIndex = index++;

    // Hash del contenido semántico: handler + tipo + contenido
    const contentHash = createHash("sha256")
      .update(`${handlerName}:${type}:${content || currentIndex}`)
      .digest("hex")
      .slice(0, 12); // 12 chars suficiente para unicidad práctica

    return contentHash as IRNodeId;
  };
};

/**
 * Metadata de contexto para el nodo (opcional, NO parte del ID)
 * Se puede agregar al nodo como propiedad separada 'meta'
 */
export interface NodeMeta {
  handler: string;
  type: string;
  index: number;
}
