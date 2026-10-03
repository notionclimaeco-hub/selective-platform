# Climaeco Platform

Climaeco serves end customers as a certified HVAC installer and installer companies as an HVAC distributor through one customer-facing platform.

## Audiences and accounts

**End customer**:
A person or business seeking HVAC equipment together with guidance, quotation, or installation from Climaeco.
_Avoid_: Public customer, anonymous customer

**Installer company**:
A professional HVAC business that buys equipment from Climaeco for resale or installation. Its members share commercial terms and order history.
_Avoid_: Installer account, reseller user

**Installer member**:
A person who acts for an installer company, such as its owner, buyer, or technician.
_Avoid_: Installer, account

**Approved installer company**:
An installer company that Climaeco has authorized to see reseller prices and place installer orders.
_Avoid_: Approved user, pro user

**Admin app**:
The staff-only application where Climaeco staff approve installer companies, set tiers, manage the catalog and its imports, and run installer orders and their documents.
_Avoid_: Back-office, desk, office desk

**Suspended installer company**:
An installer company that staff has frozen: members keep sign-in, but reseller prices and new installer orders are blocked and unpaid orders are cancelled.
_Avoid_: Banned account, deactivated company

## Catalog and pricing

**SKU**:
One purchasable equipment reference in the catalog.
_Avoid_: Product, variant

**Product page**:
A catalog presentation that groups related SKUs so a visitor can select among their variants.
_Avoid_: Product family, SKU page

**PVP**:
The VAT-exclusive list price shown publicly for a SKU.
_Avoid_: Public price, retail price

**Supplier discount**:
Climaeco's per-brand purchasing discount from that brand's PVP.
_Avoid_: Brand discount, installer discount

**Catalog cost**:
Climaeco's expected cost for a SKU before a supplier confirms an installer order.
_Avoid_: Supplier price, purchase price

**Reseller price**:
The VAT-exclusive price offered to an approved installer company, calculated using that company's tier and the SKU's brand.
_Avoid_: Installer price, discounted price

**Tier**:
A commercial level of an installer company that selects its per-brand reseller-price discounts.
_Avoid_: Discount level, price list, escalão

**Tier pin**:
A staff override that holds an installer company on a chosen tier until staff changes or clears it. Lifetime paid volume never auto-demotes.
_Avoid_: Manual tier, locked tier

**Lifetime paid volume**:
The net VAT-exclusive reseller amount an installer company has actually paid, counted at payment confirmation and decremented by refunds. It promotes the company's tier and never demotes it.
_Avoid_: Turnover, sales total, gross volume

## Requests and orders

**Quote list**:
The visitor's working list of SKUs and quantities. Anyone can build it while browsing; only a member of an approved installer company can submit it, which places an installer order.
_Avoid_: Cart, basket, checkout

**Quote request**:
An end customer's ask for a quotation from Climaeco. Handled outside the platform today; not part of installer commerce.
_Avoid_: RFQ, quote, public order

**Installer order**:
A purchase request placed by an approved installer company at reseller prices. It has one payment, one fatura-recibo, and one levantamento at Climaeco's warehouse. There is no pró-forma: once every remaining line is stock-confirmed, the order page itself is what the installer pays.
_Avoid_: Quote request, customer order

**Installer-order line**:
One SKU and quantity on an installer order, with its own stock confirmation and warehouse progress.
_Avoid_: Item, order item, product row

**Installer-order stage**:
Where an installer order stands, in office order: Recebida → A confirmar stock → Aguardar pagamento → Por encomendar → Em trânsito → Em armazém → Concluída, or Cancelada from any stage before payment. The order is in exactly one stage; per-marca progress lives inside it.
_Avoid_: Status, column, step

**Supplier fulfillment**:
The lines of one marca on an installer order, grouped so the office can request stock from and then purchase from that supplier. A supplier fulfillment is ordered once its fatura do fornecedor is recorded; lines of one marca may still reach the warehouse on different days.
_Avoid_: Sub-order, split order, shipment

**Por encomendar**:
The stage after payment while the office still has to place the purchase with at least one supplier, by email or on the supplier's portal. It ends when every supplier fulfillment with quantity still wanted has a fatura do fornecedor.
_Avoid_: Paga, pending purchase, to order

**Fatura do fornecedor**:
The supplier's invoice for what Climaeco bought from that supplier for one installer order. Recording it marks that supplier fulfillment as ordered and its quantity as em trânsito.
_Avoid_: Fatura-recibo (ours, to the installer), purchase order, nota de encomenda, guia do fornecedor

**Em trânsito**:
The stage after every supplier fulfillment is ordered, until every remaining quantity is at Climaeco's warehouse or failed.
_Avoid_: Shipped, enviada, paga

**Quantidade falhada**:
Paid quantity a supplier will not deliver, whether it was still to order or already em trânsito. It is refunded to the installer.
_Avoid_: Cancelled quantity, out of stock, backorder

**Guia do fornecedor**:
The supplier's transport-document number for goods arriving at Climaeco's warehouse. Optional: the office may note it at receção; it does not move an order between stages (the fatura do fornecedor does).
_Avoid_: Guia de transporte (that is ours, at levantamento), tracking number, delivery note, CMR

**Levantamento**:
Collection of paid goods by the installer at Climaeco's warehouse. One per installer order: the installer collects everything at once when the order is em armazém, and the office records it in the admin app (*Registar levantamento*), which completes the order.
_Avoid_: Delivery, home delivery, shipment to the installer, partial pickup

**Em armazém**:
The stage once every remaining quantity is at Climaeco's warehouse or failed, with something left to collect. Installers see it as "Pronta a levantar". If everything failed there is nothing to collect and the order completes directly. *Concluída* means collected.
_Avoid_: Delivered, arrived, ready for delivery

**Price snapshot**:
The reseller price frozen on an installer-order line when that line is added to the order.
_Avoid_: Live price, current price

## Documents and payment

**Payment link**:
A token URL on Climaeco's site where the installer pays the installer order by bank transfer, valid for seven calendar days.
_Avoid_: Checkout, hosted checkout, Revolut link

**Fatura-recibo**:
The single certified InvoiceXpress document (invoice and receipt in one) issued when payment is confirmed.
_Avoid_: Invoice, receipt, fatura and recibo as two documents, pró-forma

**Nota de crédito**:
The InvoiceXpress credit note issued when paid quantity on an installer-order line is refunded.
_Avoid_: Credit note, refund document

**Guia de transporte**:
Climaeco's InvoiceXpress transport document issued when the installer collects the goods at levantamento.
_Avoid_: Guia do fornecedor (the supplier's, inbound), delivery note, CMR

**Pró-forma**:
Not used. The installer order page is the quote the installer pays; no pró-forma document is issued.
_Avoid_: Quote, estimate, orçamento, proforma

## Catalog import

**Price table**:
A brand's yearly PDF price list, the only source of SKUs, PVPs and specs in the catalog.
_Avoid_: Catalog PDF, brochure, tabela

**Import run**:
One pass of a price table through extraction, staging and review, ending in approval or rejection for that brand and year. Approving a run replaces the brand's catalog: every staged SKU becomes a published catalog SKU and every catalog SKU of the brand absent from the run becomes a discontinued SKU.
_Avoid_: Import, upload, batch

**Staged SKU**:
A SKU extracted from a price table and held for review; it only becomes a catalog SKU when its import run is approved.
_Avoid_: Draft product, candidate, row

**Spec registry**:
The single list of allowed spec keys per product category, with type, unit and display order, that every staged SKU is validated against.
_Avoid_: Attribute list, schema, field map

**Hero specs**:
The few registry keys per category shown on catalog cards and at the top of a product page on phones.
_Avoid_: Key fields, highlights, summary specs

**Compatibility**:
The set of indoor units a multi-split outdoor unit accepts, as printed in the price table.
_Avoid_: Combination table, pairing, matrix

**Discontinued SKU**:
A catalog SKU absent from the latest approved price table of its brand; hidden from the catalog but kept for order history.
_Avoid_: Deleted product, archived, removed
