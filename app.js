// 全局状态
let currentUserId = null;
let tasks = [];

// DOM元素
const userIdInput = document.getElementById('userIdInput');
const loadUserDataBtn = document.getElementById('loadUserData');
const currentUserSpan = document.getElementById('currentUser');
const totalPointsSpan = document.getElementById('totalPoints');
const weekPointsSpan = document.getElementById('weekPoints');
const tasksContainer = document.getElementById('tasksContainer');
const recordsTableBody = document.querySelector('#recordsTable tbody');
const todayCompletedSpan = document.getElementById('todayCompleted');
const streakDaysSpan = document.getElementById('streakDays');
const totalRecordsSpan = document.getElementById('totalRecords');
const refreshDataBtn = document.getElementById('refreshData');
const testConnectionBtn = document.getElementById('testConnection');

// 事件监听器
loadUserDataBtn.addEventListener('click', loadUserData);
refreshDataBtn.addEventListener('click', refreshAllData);
testConnectionBtn.addEventListener('click', testDatabaseConnection);

// 页面加载时尝试从本地存储获取用户ID
window.addEventListener('DOMContentLoaded', () => {
    const savedUserId = localStorage.getItem('savedUserId');
    if (savedUserId) {
        userIdInput.value = savedUserId;
        loadUserData();
    }
});

// 加载用户数据
async function loadUserData() {
    const userId = userIdInput.value.trim();
    
    if (!userId) {
        alert('请输入用户ID');
        return;
    }
    
    currentUserId = userId;
    localStorage.setItem('savedUserId', userId);
    currentUserSpan.textContent = userId;
    
    // 更新UI
    loadUserDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
    loadUserDataBtn.disabled = true;
    
    try {
        // 并行加载任务和用户数据
        await Promise.all([
            loadTasks(),
            loadUserRecords(),
            calculateUserStats()
        ]);
        
        loadUserDataBtn.innerHTML = '<i class="fas fa-check"></i> 数据已加载';
        setTimeout(() => {
            loadUserDataBtn.innerHTML = '<i class="fas fa-user"></i> 加载我的数据';
            loadUserDataBtn.disabled = false;
        }, 1500);
        
    } catch (error) {
        console.error('加载数据失败:', error);
        alert('加载数据失败，请检查控制台错误信息');
        loadUserDataBtn.innerHTML = '<i class="fas fa-user"></i> 加载我的数据';
        loadUserDataBtn.disabled = false;
    }
}

// 加载任务列表
async function loadTasks() {
    try {
        // 假设你的任务表名为 'tasks'
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('is_active', true)  // 假设有 is_active 字段来筛选活跃任务
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        tasks = data || [];
        renderTasks();
    } catch (error) {
        console.error('加载任务失败:', error);
        tasksContainer.innerHTML = `<p class="error-message">加载任务失败: ${error.message}</p>`;
    }
}

// 渲染任务卡片
function renderTasks() {
    if (tasks.length === 0) {
        tasksContainer.innerHTML = '<p class="no-data">暂无任务，请先在Supabase后台创建任务</p>';
        return;
    }
    
    tasksContainer.innerHTML = '';
    
    tasks.forEach(task => {
        const taskCard = document.createElement('div');
        taskCard.className = 'task-card';
        
        // 根据难度设置样式
        const difficultyClass = `difficulty-${task.difficulty || 'medium'}`;
        const difficultyText = { easy: '简单', medium: '中等', hard: '困难' }[task.difficulty] || '中等';
        
        taskCard.innerHTML = `
            <div class="task-header">
                <h3>${task.task_name}</h3>
                <span class="task-difficulty ${difficultyClass}">${difficultyText}</span>
            </div>
            <p class="task-description">${task.description || '暂无描述'}</p>
            <div class="task-points">+${task.base_points || 0} 积分</div>
            <div class="task-actions">
                <button class="checkin-btn" data-task-id="${task.id}">
                    <i class="fas fa-check-circle"></i> 立即打卡
                </button>
                <span class="checkin-count">今日完成: <span id="count-${task.id}">0</span> 次</span>
            </div>
        `;
        
        tasksContainer.appendChild(taskCard);
    });
    
    // 为所有打卡按钮添加事件监听器
    document.querySelectorAll('.checkin-btn').forEach(btn => {
        btn.addEventListener('click', handleCheckIn);
    });
    
    // 更新今日打卡次数
    updateTodayCheckinCounts();
}

// 处理打卡
async function handleCheckIn(event) {
    const taskId = event.currentTarget.getAttribute('data-task-id');
    const task = tasks.find(t => t.id == taskId);
    
    if (!task || !currentUserId) return;
    
    const btn = event.currentTarget;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 打卡中...';
    btn.disabled = true;
    
    try {
        // 假设你的打卡记录表名为 'checkin_records'
        const { data, error } = await supabase
            .from('checkin_records')
            .insert([
                {
                    user_id: currentUserId,
                    task_id: taskId,
                    earned_points: task.base_points || 10,
                    checkin_date: new Date().toISOString().split('T')[0] // 今天日期
                }
            ]);
        
        if (error) throw error;
        
        // 打卡成功
        btn.innerHTML = '<i class="fas fa-check-circle"></i> 打卡成功!';
        btn.style.backgroundColor = '#10b981';
        
        // 短暂延迟后更新数据
        setTimeout(() => {
            refreshAllData();
        }, 1000);
        
    } catch (error) {
        console.error('打卡失败:', error);
        btn.innerHTML = '<i class="fas fa-times-circle"></i> 打卡失败';
        btn.style.backgroundColor = '#ef4444';
        
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-check-circle"></i> 立即打卡';
            btn.style.backgroundColor = '';
            btn.disabled = false;
        }, 2000);
    }
}

// 加载用户打卡记录
async function loadUserRecords() {
    if (!currentUserId) return;
    
    try {
        // 假设你的打卡记录表名为 'checkin_records'
        // 并且与任务表通过 task_id 关联
        const { data, error } = await supabase
            .from('checkin_records')
            .select(`
                *,
                tasks:task_id (task_name)
            `)
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false })
            .limit(50);  // 最多显示50条记录
        
        if (error) throw error;
        
        renderRecords(data || []);
    } catch (error) {
        console.error('加载打卡记录失败:', error);
        recordsTableBody.innerHTML = `<tr><td colspan="3" class="error-message">加载记录失败: ${error.message}</td></tr>`;
    }
}

// 渲染打卡记录
function renderRecords(records) {
    if (records.length === 0) {
        recordsTableBody.innerHTML = '<tr><td colspan="3" class="no-data">暂无打卡记录</td></tr>';
        return;
    }
    
    recordsTableBody.innerHTML = '';
    
    records.forEach(record => {
        const row = document.createElement('tr');
        
        // 格式化日期时间
        const date = new Date(record.created_at);
        const formattedDate = date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        row.innerHTML = `
            <td>${record.tasks?.task_name || '未知任务'}</td>
            <td>${formattedDate}</td>
            <td>+${record.earned_points || 0} 积分</td>
        `;
        
        recordsTableBody.appendChild(row);
    });
    
    totalRecordsSpan.textContent = records.length;
}

// 计算用户统计信息
async function calculateUserStats() {
    if (!currentUserId) return;
    
    try {
        // 计算总积分
        const { data: totalData, error: totalError } = await supabase
            .from('checkin_records')
            .select('earned_points')
            .eq('user_id', currentUserId);
        
        if (totalError) throw totalError;
        
        const totalPoints = totalData.reduce((sum, record) => sum + (record.earned_points || 0), 0);
        totalPointsSpan.textContent = totalPoints;
        
        // 计算本周积分
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // 周日开始
        startOfWeek.setHours(0, 0, 0, 0);
        
        const { data: weekData, error: weekError } = await supabase
            .from('checkin_records')
            .select('earned_points')
            .eq('user_id', currentUserId)
            .gte('created_at', startOfWeek.toISOString());
        
        if (weekError) throw weekError;
        
        const weekPoints = weekData.reduce((sum, record) => sum + (record.earned_points || 0), 0);
        weekPointsSpan.textContent = weekPoints;
        
        // 计算今日已完成任务数
        const today = new Date().toISOString().split('T')[0];
        const { data: todayData, error: todayError } = await supabase
            .from('checkin_records')
            .select('task_id')
            .eq('user_id', currentUserId)
            .eq('checkin_date', today);
        
        if (todayError) throw todayError;
        
        todayCompletedSpan.textContent = todayData?.length || 0;
        
        // 这里可以添加计算连续打卡天数的逻辑
        // 简化版：假设连续打卡天数
        streakDaysSpan.textContent = calculateStreakDays(totalData || []);
        
    } catch (error) {
        console.error('计算统计信息失败:', error);
    }
}

// 更新今日打卡次数显示
async function updateTodayCheckinCounts() {
    if (!currentUserId || tasks.length === 0) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const { data, error } = await supabase
            .from('checkin_records')
            .select('task_id')
            .eq('user_id', currentUserId)
            .eq('checkin_date', today);
        
        if (error) throw error;
        
        // 统计每个任务的打卡次数
        const counts = {};
        data?.forEach(record => {
            counts[record.task_id] = (counts[record.task_id] || 0) + 1;
        });
        
        // 更新显示
        tasks.forEach(task => {
            const countElement = document.getElementById(`count-${task.id}`);
            if (countElement) {
                countElement.textContent = counts[task.id] || 0;
            }
        });
        
    } catch (error) {
        console.error('更新打卡次数失败:', error);
    }
}

// 刷新所有数据
async function refreshAllData() {
    if (!currentUserId) {
        alert('请先输入用户ID并加载数据');
        return;
    }
    
    refreshDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 刷新中...';
    
    try {
        await Promise.all([
            loadTasks(),
            loadUserRecords(),
            calculateUserStats()
        ]);
        
        refreshDataBtn.innerHTML = '<i class="fas fa-check"></i> 刷新成功';
        setTimeout(() => {
            refreshDataBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 刷新数据';
        }, 1500);
        
    } catch (error) {
        console.error('刷新数据失败:', error);
        refreshDataBtn.innerHTML = '<i class="fas fa-times"></i> 刷新失败';
        setTimeout(() => {
            refreshDataBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 刷新数据';
        }, 2000);
    }
}

// 测试数据库连接
async function testDatabaseConnection() {
    testConnectionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 测试中...';
    
    try {
        // 尝试从任务表获取一条数据来测试连接
        const { data, error } = await supabase
            .from('tasks')
            .select('id')
            .limit(1);
        
        if (error) throw error;
        
        testConnectionBtn.innerHTML = '<i class="fas fa-check"></i> 连接成功';
        testConnectionBtn.style.backgroundColor = '#10b981';
        
        setTimeout(() => {
            testConnectionBtn.innerHTML = '<i class="fas fa-plug"></i> 测试数据库连接';
            testConnectionBtn.style.backgroundColor = '';
        }, 2000);
        
    } catch (error) {
        console.error('数据库连接测试失败:', error);
        testConnectionBtn.innerHTML = '<i class="fas fa-times"></i> 连接失败';
        testConnectionBtn.style.backgroundColor = '#ef4444';
        
        setTimeout(() => {
            testConnectionBtn.innerHTML = '<i class="fas fa-plug"></i> 测试数据库连接';
            testConnectionBtn.style.backgroundColor = '';
        }, 3000);
    }
}

// 计算连续打卡天数 (简化版本)
function calculateStreakDays(records) {
    if (!records || records.length === 0) return 0;
    
    // 获取所有打卡日期
    const dates = [...new Set(records.map(r => {
        const date = new Date(r.created_at);
        return date.toISOString().split('T')[0];
    }))].sort().reverse();
    
    if (dates.length === 0) return 0;
    
    // 检查今天是否打卡
    const today = new Date().toISOString().split('T')[0];
    let streak = dates[0] === today ? 1 : 0;
    
    // 检查连续天数
    for (let i = 1; i < dates.length; i++) {
        const current = new Date(dates[i-1]);
        const previous = new Date(dates[i]);
        const diffDays = Math.floor((current - previous) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            streak++;
        } else {
            break;
        }
    }
    
    return streak;
}