// 移除了地图相关的全局变量和函数

function renderResults(data) {
    const result = data.city_card_data;
    
    document.getElementById('city-title').innerText = result.title;
    
    // 渲染旅游路线文本
    // 确保 travel_route 数组存在且有效
    const routeHtml = Array.isArray(result.travel_route) ? result.travel_route.map(day => 
        `<div class="day-route"><strong>第 ${day.day} 天:</strong> ${day.route}</div>`
    ).join('') : '<p>路线数据生成失败。</p>';
    
    document.getElementById('travel-route').innerHTML = routeHtml;
    
    // 渲染城市数据和美食
    document.getElementById('city-data').innerText = result.city_data;
    document.getElementById('local-delicacies').innerText = Array.isArray(result.local_delicacies) ? result.local_delicacies.join('、 ') : result.local_delicacies;
    
    document.getElementById('results-card').style.display = 'block';
}

async function generatePlan() {
    const geminiKey = document.getElementById('gemini-key').value.trim();
    const city = document.getElementById('city').value.trim();
    const days = document.getElementById('days').value.trim();
    const requiredSpots = document.getElementById('required-spots').value.trim();
    const button = document.getElementById('plan-button');
    const loading = document.getElementById('loading-spinner');

    if (!geminiKey || !city || !days) {
        alert("请输入 Gemini Key、目的地和旅行天数!");
        return;
    }

    button.disabled = true;
    loading.style.display = 'block';
    document.getElementById('results-card').style.display = 'none';

    try {
        // 调用 Cloudflare Pages Function
        const response = await fetch('/api/plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                geminiKey,
                city,
                days: parseInt(days),
                requiredSpots
            }),
        });

        const result = await response.json();

        if (response.ok && !result.error) {
            renderResults(result);
        } else {
            alert("规划失败：" + (result.error || "服务器错误，请检查您的 Gemini Key 或输入格式。"));
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        alert('网络请求或服务器错误：' + error.message);
    } finally {
        button.disabled = false;
        loading.style.display = 'none';
    }
}

// 应用程序不再依赖 initMap，可以立即运行。
// 注意：如果您的 HTML 中还有 initMap 的引用（例如 onload），请移除。