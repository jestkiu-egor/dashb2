const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync('../../.env', 'utf8');
const config = {};
env.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) config[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const s = createClient(config.VITE_SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
    console.log('--- DB CONTENT REPORT ---');
    
    const { data: projects } = await s.from('projects').select('id, name');
    console.log('Projects:', projects);

    const { data: columns } = await s.from('kanban_columns').select('*');
    console.log('Columns in kanban_columns:', columns);
}
checkData();
