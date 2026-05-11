/**
 * Context-Aware SQL Generator Service
 * Supports both MySQL and PostgreSQL syntax
 * Uses OpenAI if key available, else rule-based fallback
 */

async function generateWithOpenAI(naturalLanguage, schema, dialect = 'mysql') {
  const schemaDescription = schema
    .map(table => {
      const cols = table.columns.map(c =>
        `  ${c.name} (${c.type}${c.isPrimaryKey ? ', PK' : ''}${c.isForeignKey ? ', FK' : ''})`
      ).join('\n');
      return `Table: ${table.name}\nColumns:\n${cols}`;
    }).join('\n\n');

  const prompt = `You are a ${dialect.toUpperCase()} database expert. Generate a SQL query for the request below.

DATABASE SCHEMA:
${schemaDescription}

RULES:
- Only generate SELECT queries (no INSERT, UPDATE, DELETE, DROP, etc.)
- Use proper ${dialect.toUpperCase()} syntax
- Return ONLY the SQL query, no explanation
- Use table aliases for readability
- Use backticks for MySQL column/table names if needed

REQUEST: ${naturalLanguage}

SQL QUERY:`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.1,
    }),
  });

  if (!response.ok) throw new Error('OpenAI API error');
  const data = await response.json();
  return data.choices[0].message.content.trim().replace(/```sql|```/g, '').trim();
}

function generateRuleBased(naturalLanguage, schema, dialect = 'mysql') {
  const input = naturalLanguage.toLowerCase();

  // Find relevant table
  let targetTable = schema[0];
  for (const table of schema) {
    if (input.includes(table.name.toLowerCase())) {
      targetTable = table;
      break;
    }
  }

  if (!targetTable) return `SELECT * FROM \`table_name\` LIMIT 10;`;

  const tableName = dialect === 'mysql'
    ? `\`${targetTable.name}\``
    : `${targetTable.schema}.${targetTable.name}`;

  const cols = targetTable.columns.map(c => c.name);
  const colNames = dialect === 'mysql'
    ? cols.map(c => `\`${c}\``).join(', ')
    : cols.join(', ');

  let sql = '';

  // COUNT queries
  if (input.includes('count') || input.includes('how many')) {
    const groupByCol = detectGroupBy(input, cols);
    if (groupByCol) {
      const gc = dialect === 'mysql' ? `\`${groupByCol}\`` : groupByCol;
      sql = `SELECT ${gc}, COUNT(*) AS count\nFROM ${tableName}\nGROUP BY ${gc}\nORDER BY count DESC;`;
    } else {
      sql = `SELECT COUNT(*) AS total_count\nFROM ${tableName};`;
    }
  }
  // SELECT with filters
  else if (input.includes('where') || input.includes('filter') || input.includes('find') || input.includes('get')) {
    const limit = extractLimit(input);
    const orderBy = detectOrderBy(input, cols, dialect);
    const whereClause = detectWhere(input, cols, dialect);

    sql = `SELECT ${colNames}\nFROM ${tableName}`;
    if (whereClause) sql += `\nWHERE ${whereClause}`;
    if (orderBy) sql += `\nORDER BY ${orderBy}`;
    sql += `\nLIMIT ${limit};`;
  }
  // JOIN queries
  else if ((input.includes('join') || input.includes('with')) && schema.length > 1) {
    const joinTable = schema.find(t => t.name !== targetTable.name && input.includes(t.name.toLowerCase()))
      || schema.find(t => t.name !== targetTable.name);
    if (joinTable) {
      const jt = dialect === 'mysql' ? `\`${joinTable.name}\`` : `${joinTable.schema}.${joinTable.name}`;
      const joinKey = findJoinKey(targetTable, joinTable, dialect);
      sql = `SELECT t1.*, t2.*\nFROM ${tableName} t1\nINNER JOIN ${jt} t2\n  ON ${joinKey}\nLIMIT 50;`;
    } else {
      sql = `SELECT ${colNames}\nFROM ${tableName}\nLIMIT 50;`;
    }
  }
  // DEFAULT: list all
  else {
    const limit = extractLimit(input);
    const orderBy = detectOrderBy(input, cols, dialect);
    sql = `SELECT ${colNames}\nFROM ${tableName}`;
    if (orderBy) sql += `\nORDER BY ${orderBy}`;
    sql += `\nLIMIT ${limit};`;
  }

  return sql;
}

function extractLimit(input) {
  const match = input.match(/\b(\d+)\b/);
  if (match) return Math.min(parseInt(match[1]), 1000);
  if (input.includes('all')) return 1000;
  return 50;
}

function detectOrderBy(input, cols, dialect) {
  const wrap = (c) => dialect === 'mysql' ? `\`${c}\`` : c;
  if (input.includes('latest') || input.includes('newest') || input.includes('recent')) {
    const col = cols.find(c => c.includes('created') || c.includes('date') || c.includes('time') || c.includes('updated'));
    if (col) return `${wrap(col)} DESC`;
  }
  if (input.includes('oldest')) {
    const col = cols.find(c => c.includes('created') || c.includes('date'));
    if (col) return `${wrap(col)} ASC`;
  }
  if (input.includes('order by') || input.includes('sort')) {
    const col = cols.find(c => c.includes('name') || c.includes('title'));
    if (col) return `${wrap(col)} ASC`;
  }
  return null;
}

function detectGroupBy(input, cols) {
  for (const col of cols) {
    if (input.includes(col.toLowerCase())) return col;
  }
  return cols.find(c => c.includes('status') || c.includes('type') || c.includes('category')) || null;
}

function detectWhere(input, cols, dialect) {
  const wrap = (c) => dialect === 'mysql' ? `\`${c}\`` : c;
  const patterns = [
    /where\s+(\w+)\s*=\s*['"]?([^'"]+)['"]?/i,
    /(\w+)\s+(?:is|equals?|=)\s+['"]?([^'"]+)['"]?/i,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      const col = cols.find(c => c.toLowerCase().includes(match[1].toLowerCase()));
      if (col) {
        const val = isNaN(match[2]) ? `'${match[2]}'` : match[2];
        return `${wrap(col)} = ${val}`;
      }
    }
  }
  if (input.includes('active') || input.includes('enabled')) {
    const col = cols.find(c => c.includes('status') || c.includes('active') || c.includes('enabled'));
    if (col) return `${wrap(col)} = 1`;
  }
  return null;
}

function findJoinKey(table1, table2, dialect) {
  const wrap = (t, c) => dialect === 'mysql' ? `\`${t}\`.\`${c}\`` : `${t}.${c}`;
  const fkCol = table1.columns.find(c =>
    c.name.toLowerCase() === table2.name.toLowerCase().replace(/s$/, '') + '_id'
  );
  if (fkCol) {
    const pkCol = table2.columns.find(c => c.isPrimaryKey) || { name: 'id' };
    return `t1.${wrap('', fkCol.name).replace('``.`', '`')} = t2.${wrap('', pkCol.name).replace('``.`', '`')}`;
  }
  return `t1.\`id\` = t2.\`${table1.name.replace(/s$/, '')}_id\``;
}

async function generateSQL(naturalLanguage, schema, dialect = 'mysql') {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_optional') {
    try {
      const sql = await generateWithOpenAI(naturalLanguage, schema, dialect);
      return { sql, method: 'ai' };
    } catch (err) {
      console.warn('OpenAI failed, using rule-based:', err.message);
    }
  }
  const sql = generateRuleBased(naturalLanguage, schema, dialect);
  return { sql, method: 'rule-based' };
}

module.exports = { generateSQL };
