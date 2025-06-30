# PostgreSQL Schema Exploration: ETIM and Items

## Database Structure Overview

This document provides a comprehensive overview of two interconnected schemas in the PostgreSQL database:

1. **ETIM Schema**: Contains the ETIM (Electro-Technical Information Model) classification system
2. **Items Schema**: Contains actual product data that references the ETIM classification

## Schema Relationships

```mermaid
erDiagram
    ETIM-CLASS ||--o{ ETIM-CLASSFEATUREMAP : "defines features for"
    ETIM-FEATURE ||--o{ ETIM-CLASSFEATUREMAP : "is used in"
    ETIM-VALUE ||--o{ ITEMS-PRODUCT_FEATURE : "provides values for"
    ETIM-UNIT ||--o{ ITEMS-PRODUCT_FEATURE : "provides units for"
    
    ITEMS-PRODUCT ||--|| ITEMS-PRODUCT_DETAIL : has
    ITEMS-PRODUCT ||--o{ ITEMS-PRODUCT_FEATURE : has
    ITEMS-PRODUCT_DETAIL }o--|| ETIM-CLASS : "is classified as"
    ITEMS-PRODUCT_FEATURE }o--|| ETIM-FEATURE : "references"
```

## ETIM Schema (Classification System)

The ETIM schema implements a standardized classification system for technical products:

### Class Table
Defines product classes with unique identifiers and descriptions.

**Structure:**
- ARTCLASSID (text, PK): Unique identifier for the class
- ARTGROUPID (text): Group the class belongs to
- ARTCLASSDESC (text): Human-readable description of the class
- ARTCLASSVERSION (bigint): Version number
- ARTCLASSVERSIONDATE (timestamp): Version date
- RELEASE (text): Release information

**Example:**
- "EC001744" = "Downlight/spot/floodlight"

### Feature Table
Defines characteristics that can be assigned to classes.

**Structure:**
- FEATUREID (text, PK): Unique identifier for the feature
- FEATUREDESC (text): Human-readable description of the feature
- FEATUREDEF (text): Definition or explanation of the feature
- FEATUREGROUPID (text): Group the feature belongs to

**Example:**
- "EF000004" = "Protection class according to IEC 61140"
- "EF000008" = "Width"
- "EF000015" = "Outer diameter"

### Value Table
Defines standardized values for features.

**Structure:**
- VALUEID (text, PK): Unique identifier for the value
- VALUEDESC (text): Human-readable description of the value

**Examples:**
- "EV006167" = "III" (for protection class)
- "EV000206" = "Black" (for color)
- "EV000461" = "DC" (for voltage type)

### Unit Table
Defines units of measurement.

**Structure:**
- UNITOFMEASID (text, PK): Unique identifier for the unit
- UNITDESC (text): Human-readable description of the unit
- UNITABBREV (text): Abbreviation of the unit
- DEPRECATED (boolean): Whether the unit is deprecated

**Examples:**
- "EU570448" = "Millimetre" (mm)
- "EU570126" = "Square millimetre" (mm²)

### ClassFeatureMap Table
Maps which features apply to which classes.

**Structure:**
- ARTCLASSFEATURENR (bigint, PK): Unique identifier for the mapping
- ARTCLASSID (text): Reference to the class
- FEATUREID (text): Reference to the feature
- FEATURETYPE (text): Type of feature
- UNITOFMEASID (text): Reference to the unit of measurement
- SORTNR (bigint): Sort order

## Items Schema (Product Data)

The Items schema contains actual product data that references the ETIM classification:

### Product Table
Basic product information.

**Structure:**
- id (uuid, PK): Unique identifier for the product
- catalog_id (integer): Reference to the catalog
- foss_pid (text): Product identifier
- supplier_id (integer): Reference to the supplier

### Product_Detail Table
Extended product information.

**Structure:**
- id (integer, PK): Unique identifier for the product detail
- product_id (uuid): Reference to the product
- description_short (text): Short description of the product
- description_long (text): Long description of the product
- manufacturer_pid (text): Manufacturer's product identifier
- class_id (text): Reference to the ETIM class
- family (text): Product family
- subfamily (text): Product subfamily

### Product_Feature Table
Product-specific feature values.

**Structure:**
- feature_id (bigint, PK): Unique identifier for the product feature
- product_id (uuid): Reference to the product
- fname_id (text): Reference to the ETIM feature
- fvaluec (text): Text value (often references ETIM value codes)
- fvaluen (bigint): Numeric value
- fvalueb (boolean): Boolean value
- fvaluer (numrange): Range value
- funit (text): Reference to the ETIM unit
- fvalue_detail (text): Additional value details
- etim_version (text): ETIM version

## Example Data Flow

For a specific product "MINIGRID 67 IN TRIMLESS 1 92718 B-B":

1. It's classified as "EC001744" (Downlight/spot/floodlight)
2. This class has features like:
   - "EF000004" (Protection class) = "EV006167" (III)
   - "EF000008" (Width) = 78 mm
   - "EF000015" (Outer diameter) = 67 mm
   - "EF000136" (Housing colour) = "EV000206" (Black)
   - "EF000187" (Voltage type) = "EV000461" (DC)

## Useful SQL Queries for Exploration

Here are some useful SQL queries to explore these schemas:

### List all ETIM classes
```sql
SELECT "ARTCLASSID", "ARTCLASSDESC" FROM etim.class ORDER BY "ARTCLASSID";
```

### List features for a specific class
```sql
SELECT ef."FEATUREID", ef."FEATUREDESC" 
FROM etim.feature ef
JOIN etim.classfeaturemap ecfm ON ef."FEATUREID" = ecfm."FEATUREID"
WHERE ecfm."ARTCLASSID" = 'EC001744';
```

### Get product details with their ETIM class
```sql
SELECT p.id, pd.description_short, ec."ARTCLASSDESC" as class_name
FROM items.product p
JOIN items.product_detail pd ON p.id = pd.product_id
JOIN etim.class ec ON pd.class_id = ec."ARTCLASSID";
```

### Get product features with human-readable values
```sql
SELECT 
    pd.description_short,
    ef."FEATUREDESC" as feature_name,
    CASE 
        WHEN pf.fvaluec IS NOT NULL THEN ev."VALUEDESC"
        WHEN pf.fvaluen IS NOT NULL THEN pf.fvaluen::text || ' ' || eu."UNITABBREV"
        WHEN pf.fvalueb IS NOT NULL THEN pf.fvalueb::text
        ELSE 'N/A'
    END as feature_value
FROM 
    items.product p
JOIN 
    items.product_detail pd ON p.id = pd.product_id
JOIN 
    items.product_feature pf ON p.id = pf.product_id
JOIN 
    etim.feature ef ON pf.fname_id = ef."FEATUREID"
LEFT JOIN 
    etim.value ev ON pf.fvaluec = ev."VALUEID"
LEFT JOIN 
    etim.unit eu ON pf.funit = eu."UNITOFMEASID"
WHERE 
    pd.class_id = 'EC001744'
LIMIT 20;
```

### Find products with specific feature values
```sql
SELECT 
    pd.description_short
FROM 
    items.product p
JOIN 
    items.product_detail pd ON p.id = pd.product_id
JOIN 
    items.product_feature pf ON p.id = pf.product_id
WHERE 
    pf.fname_id = 'EF000136' -- Housing colour
    AND pf.fvaluec = 'EV000206' -- Black
LIMIT 10;
```

### Count products by class
```sql
SELECT 
    ec."ARTCLASSDESC" as class_name,
    COUNT(*) as product_count
FROM 
    items.product_detail pd
JOIN 
    etim.class ec ON pd.class_id = ec."ARTCLASSID"
GROUP BY 
    ec."ARTCLASSDESC"
ORDER BY 
    product_count DESC;
```

## Connection Configuration

To connect to this PostgreSQL database, use a connection string with SSL enabled:

```
postgresql://username:password@hostname:port/database?sslmode=require
```

For Node.js applications using the pg library, you may need to set:

```javascript
const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});
```

Or use the environment variable:

```
NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Conclusion

The ETIM and Items schemas work together to provide a standardized way of classifying and describing technical products. The ETIM schema provides the classification system, while the Items schema contains the actual product data that references this classification.

This structure allows for consistent and standardized product information across different suppliers and catalogs, making it easier to search, compare, and categorize products.