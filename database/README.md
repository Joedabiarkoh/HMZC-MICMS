# HMZC Database Reference

Tables named across the source chat (schemas not yet written — only the
list of tables and relationships were specified):

users, roles, permissions, customers, vessels, equipment, inspections,
certificates, certificate_items, attachments, signatures, audit_logs,
notifications, inventory, finance

## Known relationships (from the chat's ER sketch)

- USER creates INSPECTION
- INSPECTION belongs to VESSEL
- VESSEL owned by CUSTOMER
- INSPECTION generates CERTIFICATE
- CERTIFICATE contains ATTACHMENTS
- CERTIFICATE verified by QR CODE

## Roles

ADMIN, TECHNICAL_MANAGER, INSPECTOR, ENGINEER, CUSTOMER, VIEW_ONLY
(the Finance module additionally mentions Finance Manager and Sales
Coordinator, which weren't in the original role list — reconcile these
when building Module 2: User Management + JWT Authentication.)

Next step: build these as SQLAlchemy models under
`backend-fastapi/app/models/`, one file per entity, then generate the
first Alembic migration.
