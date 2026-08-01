"""add invoice terms and conditions to notification_settings

Revision ID: 0010_terms_conditions
Revises: 0009_bank_details
Create Date: 2026-08-01

Requested directly: print HMZC's invoice Terms and Conditions on every
invoice, from a supplied reference document. Same admin-editable,
company-wide setting pattern as bank details/PEPPOL ID — seeded here
with the real text supplied so it's live immediately, still editable
from Settings afterward. Stored as one clause per line ("Label: body
text") so the frontend can bold each clause's label the same way the
source document did, without needing markdown/structured storage.
"""
from alembic import op
import sqlalchemy as sa

revision = "0010_terms_conditions"
down_revision = "0009_bank_details"
branch_labels = None
depends_on = None

TERMS_AND_CONDITIONS = """These Terms and Conditions shall apply to the purchase of the goods/services detailed overleaf (“Goods/Services”) by you (“Customer”) from Bluetech Marine Services LLC (“Company”) and to the payment of this invoice. No other terms and conditions shall apply to the sale of the Goods/Services or this invoice unless agreed upon in writing between the Customer and the Company. The essence of these Terms and Conditions remains the same as those included in the Company's quotation.
Goods/Services: The description of the Goods/Services is as set out in the Company's quotation and confirmed in the quotation and this invoice. In accepting the quotation, the Customer has acknowledged that it does not rely on any other representations regarding the Goods/Services save for those made in writing by the Company. The Company reserves the right to make any changes in the specification of the Goods/Services that are required to conform to any applicable safety or other statutory or regulatory requirements.
Price: The Price of the Goods/Services shall be that detailed in the quotation, accepted by the Customer, and confirmed in this invoice. The Price is exclusive of fees for packaging and transportation/delivery.
Basis of Sale: The quotation and invoice constitute written acceptance and confirmation by the Company to sell the Goods/Services that the Customer has accepted. The Company and the Customer have entered into a contract for the sale of the Goods/Services.
Payment: The Customer shall pay the Price stated in this invoice in advance or otherwise in accordance with any credit terms agreed between the Company and the Customer. Payment must be remitted to the account details provided on the invoice.
Late Payments: If the Customer fails to make payment within the credit period approved, the Company may suspend any further deliveries to the Customer, cancel any pending orders from the Customer, and charge the Customer delay charges at the rate of 2% per month until payment is received in full. Time for payment is of the essence of the Contract between the Company and the Customer.
Currency and Conversion Fees: All payments should be made in the currency specified on the invoice. If payment is made in a different currency, the payer assumes responsibility for any currency conversion fees or fluctuations that affect the received amount.
Bank and Transaction Fees: The Customer is responsible for all bank and transaction fees associated with the payment, including any fees for international wire transfers. Payments must reflect the full invoice amount without deductions.
Taxes and Duties: Unless otherwise specified, prices on the invoice exclude all applicable taxes, including but not limited to VAT, GST, customs duties, and import/export fees. The Customer is responsible for settling any such charges, and these will be added to the invoice as applicable.
Notice of Discrepancies: If there are any discrepancies, disputes, or issues with charges on the invoice, Customer must notify Company in writing within 3 (three) days of receiving this invoice. Failure to raise a dispute within this period will be deemed as acceptance of the invoice as issued.
Delivery: The Company has delivered the Goods/Services to the Customer, enclosing this invoice or has notified the Customer that the Goods/Services are ready for collection by the Customer.
Goods and Services Warranty: Any warranty on products or services provided by the Company is subject to the terms outlined in the relevant service agreement. No additional warranties are provided unless specifically stated in writing.
Returns, Refunds, and Adjustments: Company's refund, return, and adjustment policies, if applicable, are outlined in the service agreement. Refunds and adjustments are subject to compliance with these terms and may require prior authorization.
Collection and Legal Fees: In cases of non-payment beyond the credit period approved, the Customer agrees to pay any costs incurred by the Company to recover the outstanding balance, including but not limited to collection fees, legal fees, and court costs.
Confidentiality: All information contained in this invoice, including prices and terms, is confidential and intended solely for the recipient. Disclosure to third parties is not permitted without written consent.
Limitations of Liability: The Company shall not be liable for any loss or damages of any nature, direct or indirect, including any loss of profits or consequential damages suffered or incurred by the Customer for whatever reason. In no event, the Company's aggregate liability shall not exceed the amount paid to the Company by the Customer.
Force Majeure: Neither party shall be liable for any failure or delay in performing their obligations where such failure or delay results from any cause that is beyond the reasonable control of that party. Such causes include, but are not limited to: power failure, Internet Company failure, industrial action, civil unrest, fire, flood, storms, earthquakes, acts of terrorism, acts of war, governmental action or any other event that is beyond the control of the party in question. The Force Majeure event affecting the Customer shall not relieve the Customer of the obligation to pay any amounts owing under this Agreement in relation to services already performed by the Company.
Severance: In the event that one or more of these Terms and Conditions is found to be unlawful, invalid or otherwise unenforceable, that/those provisions shall be deemed severed from the remainder of these Terms and Conditions (which shall remain valid and enforceable).
Changes to Terms: The Company reserves the right to update or modify these invoice terms and conditions at any time. The updated terms will be reflected on future invoices and will apply to transactions from the date of modification.
Law and Jurisdiction: These Terms and Conditions (including any non-contractual matters and obligations arising therefrom or associated therewith) shall be governed by, and construed in accordance with, the laws of United Arab Emirates and the emirate of Ajman. Any dispute, controversy, proceedings or claim between the Company and the Customer relating to these Terms and Conditions (including any non-contractual matters and obligations arising therefrom or associated therewith) shall fall within the jurisdiction of the courts of Ajman."""


def upgrade() -> None:
    op.add_column("notification_settings", sa.Column("terms_conditions", sa.Text(), nullable=True))
    op.execute(
        sa.text("UPDATE notification_settings SET terms_conditions = :tc WHERE id = 1").bindparams(tc=TERMS_AND_CONDITIONS)
    )


def downgrade() -> None:
    op.drop_column("notification_settings", "terms_conditions")
