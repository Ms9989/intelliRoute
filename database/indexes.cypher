CREATE INDEX shipment_status_index IF NOT EXISTS
FOR (n:Shipment) ON (n.status);
CREATE INDEX shipment_date_index IF NOT EXISTS
FOR (n:Shipment) ON (n.shipment_date);
CREATE INDEX customer_email_index IF NOT EXISTS
FOR (n:Customer) ON (n.email);
CREATE INDEX address_pincode_index IF NOT EXISTS
FOR (n:Address) ON (n.pincode);
CREATE INDEX zone_name_index IF NOT EXISTS
FOR (n:Zone) ON (n.name);
CREATE INDEX agent_id_lookup IF NOT EXISTS
FOR (n:DeliveryAgent) ON (n.agent_id);