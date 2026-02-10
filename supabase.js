// 配置你的Supabase连接信息
// 从 Supabase 项目设置 -> API 页面获取以下信息
const SUPABASE_URL = 'https://bjvqcixvyiusoceduxli.supabase.co';  // 替换为你的 Project URL
const SUPABASE_ANON_KEY = 'sb_publishable_HUUUFWz_KZH3lccVpZTPRA_hGGS5fiK';  // 替换为你的 anon/public key


// 初始化Supabase客户端
const mySupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase客户端已初始化');

// 为了方便调试，将supabase客户端暴露到全局
window.supabaseClient = mySupabase;
