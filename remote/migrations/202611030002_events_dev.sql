-- Mirrors the current local event catalogue; development branch only.
INSERT INTO lite.lite_events(id,category,label,effect) VALUES
('demand_fair','demand','Feria local','{"id":"demand_fair","type":"demand","label":"Feria local","demand":1.15}'::jsonb),
('demand_rain','demand','Semana lluviosa','{"id":"demand_rain","type":"demand","label":"Semana lluviosa","demand":0.88}'::jsonb),
('demand_holiday','demand','Temporada festiva','{"id":"demand_holiday","type":"demand","label":"Temporada festiva","demand":1.2}'::jsonb),
('demand_slow','demand','Consumo moderado','{"id":"demand_slow","type":"demand","label":"Consumo moderado","demand":0.9}'::jsonb),
('cost_discount','cost','Descuento del proveedor','{"id":"cost_discount","type":"cost","label":"Descuento del proveedor","purchase":0.9}'::jsonb),
('cost_freight','cost','Flete más caro','{"id":"cost_freight","type":"cost","label":"Flete más caro","purchase":1.1}'::jsonb),
('cost_offer','cost','Oferta de temporada','{"id":"cost_offer","type":"cost","label":"Oferta de temporada","purchase":0.95}'::jsonb),
('cost_shortage','cost','Escasez de producto','{"id":"cost_shortage","type":"cost","label":"Escasez de producto","purchase":1.15}'::jsonb),
('opportunity_social','opportunity','Difusión comunitaria','{"id":"opportunity_social","type":"opportunity","label":"Difusión comunitaria","demand":1.1}'::jsonb),
('opportunity_market','opportunity','Mercado temporal','{"id":"opportunity_market","type":"opportunity","label":"Mercado temporal","demand":1.12}'::jsonb),
('opportunity_alliance','opportunity','Alianza comercial','{"id":"opportunity_alliance","type":"opportunity","label":"Alianza comercial","demand":1.08}'::jsonb),
('opportunity_visit','opportunity','Visita de compradores','{"id":"opportunity_visit","type":"opportunity","label":"Visita de compradores","demand":1.06}'::jsonb)
ON CONFLICT(id) DO NOTHING;
