-- Migration 003 · agentic automations
-- AUTOMATION capability marks runs executed by the automation registry.

ALTER TYPE model_capability ADD VALUE IF NOT EXISTS 'AUTOMATION';
