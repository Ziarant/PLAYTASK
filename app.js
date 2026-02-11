// 全局状态
let tasks = [];

// 全局变量存储图表实例
let chartCtx = null;

// DOM元素
const userIdInput = document.getElementById('userIdInput');
const loadUserDataBtn = document.getElementById('loadUserData');
const currentUserSpan = document.getElementById('currentUser');
const totalPointsSpan = document.getElementById('totalPoints');
const todayPointsSpan = document.getElementById('todayPoints')
const weekPointsSpan = document.getElementById('weekPoints');
const tasksContainer = document.getElementById('tasksContainer');
const consumptionContainer = document.getElementById('consumptionContainer')
const tasksCompletedContainer = document.getElementById('tasksCompletedContainer');
const recordsTableBody = document.querySelector('#recordsTable tbody');
const todayCompletedSpan = document.getElementById('todayCompleted');
const totalRecordsSpan = document.getElementById('totalRecords');
const refreshDataBtn = document.getElementById('refreshData');
const testConnectionBtn = document.getElementById('testConnection');

// 事件监听器
loadUserDataBtn.addEventListener('click', loadUserData);
refreshDataBtn.addEventListener('click', refreshAllData);
testConnectionBtn.addEventListener('click', testDatabaseConnection);

// 页面加载时尝试从本地存储获取用户ID
window.addEventListener('DOMContentLoaded', () => {
    loadUserData();
});

// 加载用户数据
async function loadUserData() {

    // 更新UI
    loadUserDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
    loadUserDataBtn.disabled = true;

    try {
        // 并行加载任务数据
        await Promise.all([
            loadTasks(),
            loadUserRecords(),
            calculateUserStats()
        ]);

        loadUserDataBtn.innerHTML = '<i class="fas fa-check"></i> 数据已加载';
        setTimeout(() => {
            loadUserDataBtn.innerHTML = '<i class="fas fa-user"></i> 加载数据';
            loadUserDataBtn.disabled = false;
        }, 1500);

    } catch (error) {
        console.error('加载数据失败:', error);
        alert('加载数据失败，请检查控制台错误信息');
        loadUserDataBtn.innerHTML = '<i class="fas fa-user"></i> 加载数据';
        loadUserDataBtn.disabled = false;
    }
}

// 加载任务列表
async function loadTasks() {
    try {
        // 假设你的任务表名为 'tasks'
        const { data, error } = await mySupabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        tasks = data || [];
        // TODO:增加日历，选择渲染日期
        renderTasks();
    } catch (error) {
        console.error('加载任务失败:', error);
        tasksContainer.innerHTML = `<p class="error-message">加载任务失败: ${error.message}</p>`;
    }
}

// 渲染任务卡片
function renderTasks(date = new Date()) {
    if (tasks.length === 0) {
        tasksContainer.innerHTML = '<p class="no-data">暂无任务，请先在Supabase后台创建任务</p>';
        return;
    }

    // 按照task.id进行排序：
    tasks.sort((a, b) => a.id - b.id);

    const today = new Date()
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayFormatted = `${year}-${month}-${day}`;

    tasksContainer.innerHTML = '';
    tasks.forEach(task => {
        const taskCard = document.createElement('div');
        taskCard.className = 'task-list';

        // TODO:积分消费逻辑中，需要改变task-points的样式
        taskCard.innerHTML = `
            <div class="task-header">
                <h3 title="ID-${task.id}:\n${task.description || '暂无描述'}">${task.task_name}</h3>
                <span class="task-tag">${task.frequency_type} | ${task.tags}</span>
            </div>
            <div class="task-frequency flex justify-between">
                <div class="task-points">${task.base_points || 0}</div>
                <div>
                    <span class="frequency_text">今日</span>获取: <span id="count-${task.id}">0</span> | ${task.frequency_max || 1}
                </div>
            </div>
            <div class="task-actions">
                <input type="number" class="task-times-input" min="-10000" max="10000" value="1" data-task-times="${task.id}">
                <input type="date" class="task-date-input" data-task-date="${task.id}" value="${todayFormatted}">
                <button class="checkin-btn" data-task-id="${task.id}">
                    <i class="fas fa-check-circle"></i> 记录
                </button>
            </div>
        `;

        if (task.tags === '生活') {
            taskCard.querySelector('.task-tag').style.backgroundColor = '#10b981'
        } else if (task.tags === '提升' || task.tags === '工作') {
            taskCard.querySelector('.task-tag').style.backgroundColor = '#48183060'
        } else if (task.tags === '健康') {
            taskCard.querySelector('.task-tag').style.backgroundColor = '#f59e0b'
        } else if (task.tags === '娱乐') {
            taskCard.querySelector('.task-tag').style.backgroundColor = '#8b5cf6'
        } else if (task.tags === '经济') {
            taskCard.querySelector('.task-tag').style.backgroundColor = '#4b6cb7'
        } else {
            taskCard.querySelector('.task-tag').style.backgroundColor = '#6b7280'
        }

        if (task.frequency_type === '每周') {
            taskCard.querySelector('.frequency_text').textContent = '本周'
        } else if (task.frequency_type === '每月') {
            taskCard.querySelector('.frequency_text').textContent = '本月'
        }

        taskCard.querySelector('.checkin-btn').addEventListener('click', handleCheckIn)

        // 先按照是否属于消费，进行卡片摆放：
        if (task.is_consume) {
            // 消费项目
            taskCard.style.borderLeftColor = '#d11a1aff'
            consumptionContainer.appendChild(taskCard)
        } else {
            tasksContainer.appendChild(taskCard)
        }

        // 判断逻辑：该task是否需要执行或展示
        const status = examineTask(task)
            .then(status => {
                if (status === 'completed') {
                    taskCard.classList.add('task-completed')
                    // 已完成的展示为
                    taskCard.style.borderLeftColor = '#353535'
                    taskCard.style.opacity = '0.6';
                    taskCard.style.pointerEvents = 'none';
                    // 若属于非消费类，从原本容器中移除
                    if (!task.is_consume) tasksContainer.removeChild(taskCard)
                    // 若消费类中不存在，则添加：
                    if (tasksCompletedContainer.querySelector(`[data-task-id="${task.id}"]`) === null) {
                        tasksCompletedContainer.append(taskCard.cloneNode(true))
                    }
                }
            });
    });

    // 更新今日记录次数
    updateTodayCheckinCounts(date);
}

// TODO:处理任务状态：
async function examineTask(task) {
    let status = 'active'

    // frequency设置为-1时，表示无限制：
    if (task.frequency_max === -1) return status

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0); // 设置为本地时间“今天的00:00:00”
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1); // 设置为本地时间“明天的00:00:00”

    const frequencyType = task.frequency_type
    // 1. 任务是否需要每日重复
    if (frequencyType === '每日') {
        // 每日重复, 则检查本日的完成总次数
        const { data, error } = await mySupabase
            .from('records')
            .select('times')
            .eq('task_id', task.id)
            .gte('checkin_date', todayStart.toISOString()) // 大于等于今天开始
            .lt('checkin_date', todayEnd.toISOString())

        if (data.length > 0) {
            // 计算总和次数
            const totalTimes = data.reduce((sum, item) => sum + item.times, 0)
            if (totalTimes >= task.frequency_max) status = 'completed'
        }
    }
    // 2. 任务是否需要每周重复
    // 3. 任务是否需要每月重复
    // 4. 任务是否需要每年重复
    // 5. 任务是否需要特定日期重复
    // 6. 任务是否需要特定时间段重复
    // 7. 任务是否需要特定星期几重复
    return status  // 或 'completed', 'inactive'
}

// 处理打卡
async function handleCheckIn(event) {
    const taskId = event.currentTarget.getAttribute('data-task-id');
    // 根据taskId锁定卡片中的次数信息：
    const times = parseInt(document.querySelector(`[data-task-times="${taskId}"]`).value) || 1
    const date = document.querySelector(`[data-task-date="${taskId}"]`).value
    const task = tasks.find(t => t.id == taskId);

    if (!task) return;

    const btn = event.currentTarget;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 记录中...';
    btn.disabled = true;

    // 计算获取积分：task.base_points * timestimes
    const earned = await calculatePoints(task, times, date)

    try {
        const { data, error } = await mySupabase
            .from('records')        // 表名为 'records'
            .insert([
                {
                    task_id: taskId,
                    times: times,
                    earned_points: earned.points || 1,
                    buff_value: earned.buff_value || 1,
                    checkin_date: date || new Date().toLocaleDateString().split('T')[0] // 默认今天日期
                }
            ]);

        if (error) throw error;

        // 打卡成功
        btn.innerHTML = '<i class="fas fa-check-circle"></i> 记录成功!';
        btn.style.backgroundColor = '#10b981';

        // 短暂延迟后更新数据
        setTimeout(() => {
            refreshAllData();
        }, 1000);

    } catch (error) {
        console.error('记录失败:', error);
        btn.innerHTML = '<i class="fas fa-times-circle"></i> 记录失败';
        btn.style.backgroundColor = '#ef4444';

        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-check-circle"></i> 记录';
            btn.style.backgroundColor = '';
            btn.disabled = false;
        }, 2000);
    }
}

// 计算获取积分：
async function calculatePoints(task, times, date) {
    // 将文本转化为数字进行计算：
    // TODO: 增加积分规则，可以增加更多计算方法，如buff系数：

    if (isNaN(task.base_points)) return 1
    let buff = 1.0;
    let thisTimes = times;
    // 连续打卡奖励：若前一日该项目获取积分>0,系数+0.05
    // TODO: 将buff规则放在另一个表中，并使用另外的函数
    const today = new Date(date)
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    const { data, error } = await mySupabase
        .from('records')
        .select('earned_points, times')
        .eq('task_id', task.id)
        .gte('checkin_date', yesterday.toISOString())
        .lt('checkin_date', today.toISOString())
    
    if (data.length > 0 && data[0].earned_points > 0) buff *= 1.05
    // 昨日times总和：
    const yesterday_times = data.length > 0 ? data.reduce((sum, item) => sum + item.times, 0) : 0;

    // times 应当有限制：本日总已打卡数不超过task.frequency_max
    const { data:todaydata, error:todayerror } = await mySupabase
        .from('records')
        .select('times')  
        .eq('task_id', task.id)
        .gte('checkin_date', today.toISOString())
        .lt('checkin_date', todayEnd.toISOString())
    // const today_times = sum(todaydata.map(item => item.times))
    const today_times = todaydata.length > 0 ? todaydata.reduce((sum, item) => sum + item.times, 0) : 0;
    if(task.frequency_max !== -1) {
        if (today_times + times > task.frequency_max) {
            thisTimes = task.frequency_max - today_times - times > 0 ? task.frequency_max - today_times - times : task.frequency_max - today_times;
        }
    }

    // 超越奖励：本日达到或超过昨日，系数增加0.02
    if (today_times + thisTimes >= yesterday_times) buff *= 1.02

    return { points:parseFloat(task.base_points) * parseFloat(thisTimes) * buff , buff_value : buff}
}

// 加载用户打卡记录
async function loadUserRecords() {

    try {
        // 打卡记录表名为 'records'
        // 并且与任务表通过 task_id 关联
        const { data, error } = await mySupabase
            .from('records')
            .select(`
                *,
                tasks:task_id (task_name)
            `)
            .order('created_at', { ascending: false })
            .limit(500);  // 最多显示500条记录

        if (error) throw error;

        renderRecords(data || []);
    } catch (error) {
        console.error('加载记录记录失败:', error);
        recordsTableBody.innerHTML = `<tr><td colspan="3" class="error-message">加载记录失败: ${error.message}</td></tr>`;
    }
}

// 渲染打卡记录
function renderRecords(records) {
    if (records.length === 0) {
        recordsTableBody.innerHTML = '<tr><td colspan="3" class="no-data">暂无记录</td></tr>';
        return;
    }

    recordsTableBody.innerHTML = '';

    // TODO:排序方式

    records.forEach(record => {
        const row = document.createElement('tr');

        // 格式化日期时间
        const date = new Date(record.created_at);
        const formattedDate = date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // 格式化完成日期，只保留年月日：yyyy-mm-dd
        const completedDate = record.checkin_date.split('T')[0]

        const textColor = record.earned_points > 0 ? 'text-cyan-400' : 'text-red-400';
        const is_positive = record.earned_points > 0 ? '+' : '';

        row.innerHTML = `
            <td>${record.tasks?.task_name || '未知任务'}</td>
            <td>${completedDate || 'N/A'}</td>
            <td>${record.times || 1}</td>
            <td>${record.buff_value || 1}</td>
            <td class="${textColor}">${is_positive}${record.earned_points || 0}</td>
            <td>${formattedDate}</td>
        `;

        recordsTableBody.appendChild(row);
    });

    totalRecordsSpan.textContent = records.length;
}

// 获取特定日期的积分,返回{type : earned_points}
async function getDatabyDate(date) {
    // date: str, 'yyyy-mm-dd'
    const selectDateStart = new Date(date)
    selectDateStart.setHours(0, 0, 0, 0)
    const selectDateEnd = new Date(date)
    selectDateEnd.setHours(23, 59, 59, 99)
    const { data, error } = await mySupabase
        .from('records')
        .select('earned_points')
        .gte('checkin_date', selectDateStart.toISOString())
        .lt('checkin_date', selectDateEnd.toISOString())
    const Points = data.reduce((sum, record) => sum + (record.earned_points || 0), 0);
    if (error) throw error;
    return Points
}

// 计算用户统计信息
async function calculateUserStats() {

    // 设置时间信息
    const now = new Date();
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0);                        // 设置为本地时间“今天的00:00:00”
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);               // 设置为本地时间“明天的00:00:00”
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);  // 周一开始
    startOfWeek.setHours(0, 0, 0, 0);

    try {
        // 一次性获取所有记录
        // 计算总积分
        const { data, error } = await mySupabase
            .from('records')
            .select('earned_points, checkin_date');

        if (error) throw error;

        // 计算总积分
        const totalPoints = data.reduce((sum, record) => sum + (record.earned_points || 0), 0);
        totalPointsSpan.textContent = totalPoints.toFixed(2);

        // 计算本周积分
        const weekPoints = data
            .filter(record => new Date(record.checkin_date) >= startOfWeek)
            .reduce((sum, record) => sum + (record.earned_points || 0), 0);
        weekPointsSpan.textContent = weekPoints.toFixed(2);

        // 计算今日已完成任务数,日期格式为'yyyy-mm-dd 00:00:00+00',如‘2026-02-10 00:00:00+00’
        const todayData = data.filter(record => 
            new Date(record.checkin_date) >= todayStart && 
            new Date(record.checkin_date) < todayEnd
        );
        const todayPoints = todayData.reduce((sum, record) => sum + (record.earned_points || 0), 0);
        todayPointsSpan.textContent = todayPoints.toFixed(2);
        todayCompletedSpan.textContent = todayData.length;

    } catch (error) {
        console.error('计算统计信息失败:', error);
    }

    // TODO:根据标签分类
    // 统计过去15日的积分信息：
    let last15Days = []
    for (let i = 14; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toLocaleDateString().split('T')[0]
        last15Days.push({
            date: dateStr,
            points: getDatabyDate(dateStr)
        })
    }
    // 等待数据加载完成
    // Warning:每次页面加载都会重新创建图表，可能导致内存泄漏和性能问题。
    Promise.all(last15Days.map(day => day.points)).then(resolvedPoints => {
        last15Days = last15Days.map((day, index) => ({
            ...day,
            points: resolvedPoints[index]
        }))
        // 将15日积分情况绘制在画布上：
        // 在 calculateUserStats 中
        // 在 calculateUserStats 中
        if (chartCtx) {
            chartCtx.destroy(); // 销毁旧图表
        }
        chartCtx = document.getElementById('pointsChart').getContext('2d');
        new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: last15Days.map(day => day.date),
                datasets: [{
                    label: '积分',
                    data: last15Days.map(day => day.points),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    })
}

// 更新今日打卡次数显示
// TODO:更改为获取点数，并按照每日，每周，每月分类
async function updateTodayCheckinCounts(date = new Date()) {

    const todayStart = new Date(date)
    todayStart.setHours(0, 0, 0, 0); // 设置为本地时间“今天的00:00:00”
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1); // 设置为本地时间“明天的00:00:00”

    try {
        const { data, error } = await mySupabase
            .from('records')
            .select('task_id, times')
            .gte('checkin_date', todayStart.toISOString()) // 大于等于今天开始
            .lt('checkin_date', todayEnd.toISOString())

        if (error) throw error;

        // 统计每个任务的点数
        const counts = {};
        tasks.forEach(task => {
            counts[task.id] = 0;
        });
        data?.forEach(record => {
            counts[record.task_id] += Number(record.times);
        });

        // 更新显示
        tasks.forEach(task => {
            const countElement = document.getElementById(`count-${task.id}`);
            if (countElement) {
                // 不得超过task.frequency_max:
                countElement.textContent = Math.min(counts[task.id] || 0, task.frequency_max);
            }
        });

    } catch (error) {
        console.error('更新记录次数失败:', error);
    }
}

// 刷新所有数据
async function refreshAllData() {
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
        const { data, error } = await mySupabase
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