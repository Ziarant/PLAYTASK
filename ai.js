/**
 * DeepSeek AI API 交互模块
 * 用于为PLAYTASK提供智能任务建议、分析等功能
 */

// DeepSeek API 配置（替换为你的实际密钥）
const DEEPSEEK_API_KEY = "sk-f47f3a78f7b74203bdfc669965194ac3";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

/**
 * 调用DeepSeek API获取AI响应
 * @param {string} prompt - 发给AI的提示词
 * @returns {Promise<string>} AI返回的文本内容
 */
async function callDeepSeekAPI(prompt) {
  // 显示加载状态（可根据UI调整）
  showLoading(true);

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat", // 使用deepseek-chat模型，可根据需要替换
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7, // 控制回答的随机性
        max_tokens: 1000 // 最大返回字符数
      })
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // 提取AI的回答内容
    const aiResponse = data.choices[0]?.message?.content || "未获取到有效建议";
    
    return aiResponse;
  } catch (error) {
    console.error("DeepSeek API调用失败:", error);
    alert(`AI功能出错: ${error.message}`);
    return "抱歉，暂时无法获取AI建议，请稍后再试。";
  } finally {
    // 隐藏加载状态
    showLoading(false);
  }
}

/**
 * 生成针对任务管理的AI提示词（根据用户输入定制）
 * @param {string} userInput - 用户输入的需求
 * @param {Array} currentTasks - 当前用户的任务列表（可选）
 * @returns {string} 优化后的提示词
 */
function generateTaskPrompt(userInput, currentTasks = [], wholeTasks = []) {
  // 基础提示词模板，限定AI的回答范围和格式
  const basePrompt = `
    你是一个专业的个人任务管理和习惯养成助手，需要根据用户需求提供简洁、实用的建议。
    要求：
    1. 回答控制在300字以内，语言简洁易懂；
    2. 贴合个人习惯养成和任务管理场景；
    3. 给出具体、可执行的建议，而非空泛的理论；
    4. 语气友好、鼓励，符合激励用户的目标。

    今日日期：${new Date().toLocaleDateString('zh-CN')}
    
    当前用户的任务列表（可选）：
    ${currentTasks.length > 0 ? currentTasks.map(t => 
        `
        --- 任务名称：${t.title} ---
        - 点数：${t.times}
        - 完成日期：${t.date}
        - 备注：${t.remark || '无'}
        `).join("\n") : "暂无"}

    完整的任务表（可选）：
    ${wholeTasks.length > 0 ? wholeTasks.map(t => 
        `
         --- 任务名称：${t.task_name} ---
         - 任务描述：${t.description}
         - 任务基础积分点：${t.base_points}（负值表示消费）
         - 任务类别：${t.tags}
         - 最大完成次数：${t.frequency_max}（-1表示无限制）
        `).join("\n") : "暂无"}

    用户当前需求：${userInput}
  `;
  console.log("生成的提示词:", basePrompt.trim())
  return basePrompt.trim();
}

/**
 * 显示/隐藏加载状态（需配合UI实现）
 * @param {boolean} isLoading - 是否加载中
 */
function showLoading(isLoading) {
  const loadingElement = document.getElementById("ai-loading");
  if (loadingElement) {
    loadingElement.style.display = isLoading ? "block" : "none";
  }
}

// 导出函数供其他模块使用
window.aiModule = {
  callDeepSeekAPI,
  generateTaskPrompt
};