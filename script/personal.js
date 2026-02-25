// 等级/经验相关公式（复用之前的逻辑）
function getExpToLevel(level) {
    if(level <= 20) {
        return 50 * level * level; // 升级所需积分（这里将积分等价为经验）
    } else {
        return 20000 + (level - 20) * 2000; // 20级之后的升级公式，没级固定需要2000积分
    }
}

// 可激活Buff的等级门槛（初始2个，每10级新增一个Buff，最多5个）：
function getBuffForLevel(level) {
    let buffCount = 2; // 初始2个Buff:“连续打卡”和“再接再厉”
    if(level >= 10) buffCount++;
    if(level >= 20) buffCount++;
    if(level >= 30) buffCount++;
    return Math.min(buffCount, 5); // 最多5个Buff
}

// 根据积分计算当前等级和经验进度：
function calculateLevelAndExp(points) {
    let level = 1;
    while(points >= getExpToLevel(level)) {
        level++;
    }
    level--; // 因为循环结束时level已经超出当前等级，所以需要减1
    const expForCurrentLevel = getExpToLevel(level);
    const expForNextLevel = getExpToLevel(level + 1) - expForCurrentLevel;
    const expProgress = points - expForCurrentLevel;
    const expPercent = Math.min(100, Math.round((expProgress / expForNextLevel) * 100));
    // 输出：{等级， 进度百分比， 当前等级经验进度， 升级所需经验}
    return { level, expPercent, expProgress, expForNextLevel };
}

// 积分转经验值：
// 兑换限制：1. 每次兑换至少50积分；2. 总积分必须至少1000；3. 兑换后积分必须大于等于0；4. 兑换时Buff效果为1（无加成）。
const convertExpBtn = document.getElementById('convertExpBtn');
convertExpBtn.addEventListener('click', () => {
    const pointsToConvert = parseInt(document.getElementById('pointsToConvert').value, 10);
    if (isNaN(pointsToConvert) || pointsToConvert < 50) {
        alert('请输入至少50积分进行转换');
        return;
    }
    const totalPoints = parseInt(document.getElementById('totalPoints').textContent, 10);
    if (pointsToConvert > totalPoints) {
        alert('积分不足，无法转换');
        return;
    }
    if (totalPoints < 1000) {
        alert('总积分不足1000，无法进行兑换');
        return;
    }
    // 无Buff时，1积分转1经验：
    convertPointsToExp(pointsToConvert);
});

async function convertPointsToExp(pointsToConvert) {
    const exp = -1 * pointsToConvert; // 转换为负数表示扣除积分
    console.log(`转换积分：${pointsToConvert}，对应经验：${exp}`);
    const { data, error } = await mySupabase
            .from('records')        // 表名为 'records'
            .insert([
                {
                    task_id: 999, // 999表示积分转经验的特殊记录
                    times: pointsToConvert, // 转换的积分数量
                    earned_points: exp || 0, // 转换的经验数量（1积分=1经验）
                    buff_value: 1, // 转换时Buff效果为1（无加成）
                    checkin_date: new Date().toLocaleDateString().split('T')[0], // 默认今天日期
                    remark: null
                }
            ]);
    if (error) {
        console.error('积分转经验失败：', error);
        alert('积分转经验失败，请稍后再试');
    }
}