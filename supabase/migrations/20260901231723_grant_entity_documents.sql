-- Grant table privileges on directory.entity_documents.
--
-- The table shipped with RLS enabled and all four workspace-isolation policies
-- (get_my_workspace_ids(), the documented directory pattern) but no GRANTs, so
-- every call failed with "permission denied for table entity_documents" before
-- RLS was ever consulted. The entity page silently showed no documents.
--
-- Same class as the aion_insights grant gap fixed 2026-06-11: policies present,
-- privileges missing.
--
-- DELETE is deliberately not granted to authenticated: the app archives
-- documents via UPDATE (status = 'archived') and has no hard-delete path. The
-- DELETE policy stays for service-role cleanup.

GRANT SELECT, INSERT, UPDATE ON directory.entity_documents TO authenticated;
GRANT ALL ON directory.entity_documents TO service_role;
