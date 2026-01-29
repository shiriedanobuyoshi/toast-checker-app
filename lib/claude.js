const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Claude APIクライアント
 */
async function analyzeWithClaude(imageUrl, componentType, guidelines) {
    const prompt = buildAnalysisPrompt(componentType, guidelines);

  try {
        const response = await fetch(ANTHROPIC_API_URL, {
                method: 'POST',
                headers: {
                          'Content-Type': 'application/json',
                          'x-api-key': ANTHROPIC_API_KEY,
                          'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                          model: 'claude-sonnet-4-20250514',
                          max_tokens: 2000,
                          messages: [
                            {
                                          role: 'user',
                                          content: [
                                            {
                                                              type: 'image',
                                                              source: {
                                                                                  type: 'url',
                                                                                  url: imageUrl
                                                              }
                                            },
                                            {
                                                              type: 'text',
                                                              text: prompt
                                            }
                                                        ]
                            }
                                    ]
                })
        });

      if (!response.ok) {
              throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
        const analysisText = data.content[0].text;

      // JSON形式の応答をパース
      return parseAnalysisResponse(analysisText);

  } catch (error) {
        console.error('Claude API error:', error);
        throw error;
  }
}

/**
 * 分析プロンプトを構築
 */
function buildAnalysisPrompt(componentType, guidelines) {
    return `あなたはUIデザインの専門家です。以下のガイドラインに基づいて、画像内の${componentType}コンポーネントを分析してください。

    【ガイドライン】
    ${guidelines}

    【分析項目】
    1. コンポーネント名
    2. デバイスタイプ（PC/SP）
    3. 配置（上部/中央/下部）
    4. 抽出されたコンテンツ（テキスト）
    5. アクションタイプ
    6. コンプライアンススコア（0-100）
    7. 違反項目（あれば）
    8. 改善提案（あれば）
    9. 画面フロー分析（フレーム名が分かれば）
    10. サマリー

    以下のJSON形式で回答してください（JSON以外の説明は不要）：

    {
      "componentName": "コンポーネント名",
        "deviceType": "pc" または "sp",
          "placement": "top" | "center" | "bottom",
            "extractedContent": "抽出されたテキスト",
              "actionType": "アクションタイプ",
                "complianceScore": 0-100の数値,
                  "violations": ["違反項目1", "違反項目2"],
                    "recommendations": ["改善提案1", "改善提案2"],
                      "flowAnalysis": "画面フローの分析",
                        "summary": "サマリー"
                        }`;
}

/**
 * Claude APIの応答をパース
 */
function parseAnalysisResponse(text) {
    try {
          // マークダウンコードブロックを除去
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(cleanText);

      return {
              componentName: parsed.componentName || 'Unknown',
              deviceType: parsed.deviceType || 'unknown',
              placement: parsed.placement || 'center',
              extractedContent: parsed.extractedContent || '',
              actionType: parsed.actionType || 'unknown',
              complianceScore: parsed.complianceScore || 0,
              violations: parsed.violations || [],
              recommendations: parsed.recommendations || [],
              flowAnalysis: parsed.flowAnalysis || '',
              summary: parsed.summary || ''
      };
    } catch (error) {
          console.error('Failed to parse Claude response:', error);
          // フォールバック: テキストのまま返す
      return {
              componentName: 'Parse Error',
              deviceType: 'unknown',
              placement: 'center',
              extractedContent: text,
              actionType: 'unknown',
              complianceScore: 0,
              violations: ['Failed to parse response'],
              recommendations: [],
              flowAnalysis: '',
              summary: 'Analysis failed'
      };
    }
}

module.exports = {
    analyzeWithClaude
};
