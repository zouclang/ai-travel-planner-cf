/**
 * Cloudflare Pages Function: /api/plan
 * 关键修复：在所有 Response 中强制添加 'charset=utf-8'，解决中文乱码问题。
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// 构造一个纯文本指令，让模型来生成 JSON
function buildPromptText(city, days, requiredSpots) {
    const requiredText = requiredSpots ? `必去景点：${requiredSpots}。请确保所有这些景点都包含在路线中。` : '用户没有指定必去景点。';

    return `
    你是一个专业的旅游规划师。请严格按照以下要求和格式返回结果：
    
    规划要求：
    1. 目的地：${city}
    2. 旅行天数：${days}日游。
    3. 景点安排：${requiredText} 在满足必去景点的前提下，合理安排其他推荐景点，使路线流畅且优化交通。
    4. 语言要求：所有输出必须是流畅、专业的中文。
    
    **返回格式**：请严格以一个 JSON 对象的形式返回，不要包含任何文字、说明或 Markdown 标记 (如 \`\`\`json)。JSON 结构必须是：
    
    {
      "city_card_data": {
        "title": "城市名 - X日深度游",
        "travel_route": [
          {"day": 1, "route": "景点名称A -> 景点名称B"},
          // ... 更多天数
        ],
        "city_data": "关于城市历史、特色、经济等数据的简短介绍（100字以内）。",
        "local_delicacies": ["美食A", "美食B", "美食C", "美食D"]
      }
    }
    `;
}

// 增强的 JSON 清理函数
function cleanJsonString(text) {
    if (!text) return null;

    // 1. 移除 Markdown 代码块标记 (```json ... ``` 或 ``` ... ```)
    let cleaned = text.replace(/^```json\s*|```\s*$/gs, '').trim();
    cleaned = cleaned.replace(/^```\s*|```\s*$/gs, '').trim();

    // 2. 查找 JSON 对象的起始和结束位置
    const startIndex = cleaned.indexOf('{');
    const endIndex = cleaned.lastIndexOf('}');
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        cleaned = cleaned.substring(startIndex, endIndex + 1);
    } else {
        return null; // 找不到有效的 JSON 结构
    }
    
    // 3. 移除 JSON 结构体前后的空白字符
    cleaned = cleaned.trim();
    
    return cleaned;
}


// Pages Function 的处理函数
export async function onRequest(context) {
    const jsonHeader = { 'Content-Type': 'application/json; charset=utf-8' }; // 【关键修复点】

    try {
        const { request } = context;
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: jsonHeader });
        }

        const { geminiKey, city, days, requiredSpots } = await request.json();

        if (!geminiKey || !city || !days) {
            return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400, headers: jsonHeader });
        }

        const promptText = buildPromptText(city, days, requiredSpots);

        const safeGeminiKey = encodeURIComponent(geminiKey);
        
        const apiResponse = await fetch(`${GEMINI_API_URL}?key=${safeGeminiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: promptText }] }],
            }),
        });

        if (!apiResponse.ok) {
            const apiError = await apiResponse.json(); 
            console.error('Gemini API Error:', apiError);
            
            let errorMessage = `规划失败：Gemini API 调用失败: ${apiResponse.statusText}.`;
            if (apiError && apiError.error && apiError.error.message) {
                 errorMessage += ` 详情: ${apiError.error.message}`;
            }

            return new Response(
                JSON.stringify({ error: errorMessage }),
                { status: 500, headers: jsonHeader }
            );
        }

        const apiResult = await apiResponse.json();
        
        let jsonText = apiResult.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!jsonText) {
             return new Response(
                JSON.stringify({ error: "规划失败：Gemini 未能返回任何内容。" }),
                { status: 500, headers: jsonHeader }
            );
        }
        
        const cleanedJsonText = cleanJsonString(jsonText);

        if (!cleanedJsonText) {
             return new Response(
                JSON.stringify({ error: "规划失败：Gemini 返回的文本中找不到有效的 JSON 结构。" }),
                { status: 500, headers: jsonHeader }
            );
        }

        try {
            const parsedData = JSON.parse(cleanedJsonText);
             // 成功返回 JSON
             return new Response(JSON.stringify(parsedData), {
                status: 200,
                headers: jsonHeader, // 【关键修复点】
            });
        } catch (e) {
             console.error('JSON.parse Error:', e);
             return new Response(JSON.stringify({ 
                error: `规划失败：无法解析 Gemini 返回的 JSON 数据。` 
             }), {
                status: 500,
                headers: jsonHeader, // 【关键修复点】
            });
        }
        

    } catch (e) {
        console.error('Serverless Function Internal Error:', e);
        return new Response(JSON.stringify({ 
            error: `规划失败：发生内部错误（网络或运行时）。`
        }), {
            status: 500,
            headers: jsonHeader, // 【关键修复点】
        });
    }
}