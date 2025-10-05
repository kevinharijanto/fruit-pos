UPDATE Item SET type='FRUIT'  WHERE type IN ('Fruit','fruit','FRUIT 🍎');
UPDATE Item SET type='MEAT'   WHERE type IN ('Meat','meat');
UPDATE Item SET type='CUSTOM' WHERE type IS NULL OR type='' OR type NOT IN ('FRUIT','MEAT','CUSTOM');

UPDATE Item SET unit='KG'  WHERE unit IN ('kg','Kg','KG');
UPDATE Item SET unit='PCS' WHERE unit IS NULL OR unit='' OR unit IN ('pcs','Pcs','PCS');
