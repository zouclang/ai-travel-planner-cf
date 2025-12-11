/**
 * Cloudflare Pages Function: /api/plan
 * 负责接收前端请求，调用 Gemini API，并返回结构化数据。
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// 构造简化的 Prompt，不再要求经纬度
function buildPrompt(city, days, requiredSpots) {
    const requiredText = requiredSpots ? `必去景点：${requiredSpots}。请确保所有这些景点都包含在路线中。` : '用户没有指定必去景点。';

    return `
    你是一个专业的旅游规划师。请根据以下要求，为用户规划一份详细的${days}日旅行路线，并提供城市介绍信息和美食推荐。
    
    规划原则：
    1. **目的地：** ${city}
    2. **旅行天数：** ${days}日游。
    3. **景点安排：** ${requiredText} 在满足必去景点的前提下，请根据天数和城市特色，合理安排其他推荐景点，使路线流畅且优化交通。
    4. **语言要求：** 所有输出必须是流畅、专业的中文。
    
    **返回格式**：严格使用一个 JSON 对象，结构如下：
    
    {
      "city_card_data": {
        "title": "${city} - ${days}日深度游",
        "travel_route": [
          // 每天的路线描述，格式为：景点名称A -> 景点名称B
          { "day": 1, "route": "景点名称A -> 景点名称B -> 景点名称C" },
          // ... 更多天数
        ],
        "city_data": "关于城市历史、特色、经济等数据的简短介绍（100字以内）。",
        "local_delicacies": [ "美食A", "美食B", "美食C", "美食D" ]
      }
    }
    `;
}

// Pages Function 的处理函数 (onRequest 保持不变，只需确保它使用新的 buildPrompt)
export async function onRequest(context) {
    try {
        const { request } = context;
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
        }

        const { geminiKey, city, days, requiredSpots } = await request.json();

        if (!geminiKey || !city || !days) {
            return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400 });
        }

        const prompt = buildPrompt(city, days, requiredSpots);

        const apiResponse = await fetch(`${GEMINI_API_URL}?key=${geminiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    responseMimeType: "application/json",
                },
            }),
        });

        if (!apiResponse.ok) {
            const apiError = await apiResponse.text();
            console.error('Gemini API Error:', apiError);
            return new Response(
                JSON.stringify({ error: `Gemini API 调用失败: ${apiResponse.statusText}. 请检查您的 API Key。` }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const apiResult = await apiResponse.json();
        
        const jsonText = apiResult.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!jsonText) {
             return new Response(
                JSON.stringify({ error: "Gemini 未能返回结构化内容。" }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }
        
        const parsedData = JSON.parse(jsonText.trim());

        return new Response(JSON.stringify(parsedData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (e) {
        console.error('Serverless Function Error:', e);
        return new Response(JSON.stringify({ error: `Internal Server Error: ${e.message}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}