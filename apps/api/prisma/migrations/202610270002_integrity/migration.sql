-- Enforce business invariants even when requests arrive concurrently.
CREATE UNIQUE INDEX "ReleaseRequest_one_open_per_instrument"
ON "ReleaseRequest" ("instrumentId")
WHERE "status" NOT IN ('REJECTED', 'COMPLETED');

ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_positive_amount" CHECK ("amount" > 0);
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_date_order" CHECK ("issueDate" <= "maturityDate");
ALTER TABLE "Document" ADD CONSTRAINT "Document_has_parent"
CHECK ("instrumentId" IS NOT NULL OR "releaseRequestId" IS NOT NULL);

-- A trigger protects audit history independently of the application's code.
CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent is append-only' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER "AuditEvent_append_only"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "AuditEvent"
FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
