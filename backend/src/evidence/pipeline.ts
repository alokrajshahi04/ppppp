// OCR + RAG indexing pipeline for evidence, shared by every entry point
// (complete-after-presigned-PUT, upload proxy, re-index, pre-run indexing).

import { indexEvidence, ocr as aiOcr } from '../ai/client.js';
import { broadcastTaskEvent } from '../rooms/broadcaster.js';
import { setEvidenceOcrText } from '../tasks/repo.js';
import type { Evidence } from '@tolti/contracts';

export function runEvidencePipeline(evidence: Evidence): Promise<void> {
    return aiOcr({
        storage_key: evidence.storage_key,
        filename: evidence.filename,
        mime_type: evidence.mime_type,
    })
        .then(async (res) => {
            await setEvidenceOcrText(evidence.id, res.text);
            await indexEvidence({
                evidence_id: evidence.id,
                storage_key: evidence.storage_key,
                filename: evidence.filename,
                mime_type: evidence.mime_type,
                ocr_text: res.text,
                kind: evidence.kind,
            });
            broadcastTaskEvent(evidence.task_id, {
                type: 'activity',
                payload: {
                    event: 'evidence_indexed',
                    target_id: evidence.id,
                    summary: `Indexed ${evidence.filename}`,
                },
            });
        })
        .catch((e) => {
            // Failures are logged and announced to the room; the pipeline is
            // fire-and-forget, so it must never reject into the void.
            // eslint-disable-next-line no-console
            console.error('evidence.pipeline failed', evidence.id, e);
            broadcastTaskEvent(evidence.task_id, {
                type: 'activity',
                payload: {
                    event: 'evidence_index_failed',
                    target_id: evidence.id,
                    summary: `Indexing failed for ${evidence.filename}`,
                },
            });
        });
}
