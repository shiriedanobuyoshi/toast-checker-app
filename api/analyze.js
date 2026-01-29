const { getFigmaFile, getFigmaImage } = require('../lib/figma');
const { analyzeWithClaude } = require('../lib/claude');
const { getGuidelines } = require('../lib/guidelines');
const { createAnalysisRun, createAnalysisResult, createInconsistency, updateAnalysisRunStatus } = require('../lib/db');

/**
 * 分析実行API
 * POST /api/analyze
 */
module.exports = async (req, res) => {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
          return res.status(200).end();
    }

    if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
          const {
                  pcFileKey,
                  spFileKey,
                  pcPageName,
                  spPageName,
                  components = ['toast', 'accordion', 'bottomsheet']
          } = req.body;

      // バリデーション
      if (!pcFileKey || !spFileKey) {
              return res.status(400).json({ error: 'File keys are required' });
      }

      // 分析実行レコードを作成
      const run = await createAnalysisRun({
              trigger: 'manual',
              pcFileKey,
              spFileKey,
              pcPageName,
              spPageName,
              components
      });

      // 非同期で分析を実行（レスポンスは即座に返す）
      runAnalysis(run.id, { pcFileKey, spFileKey, pcPageName, spPageName, components })
            .catch(error => {
                      console.error('Analysis failed:', error);
                      updateAnalysisRunStatus(run.id, 'failed');
            });

      return res.status(202).json({
              runId: run.id,
              status: 'running',
              message: 'Analysis started'
      });

    } catch (error) {
          console.error('API error:', error);
          return res.status(500).json({ error: error.message });
    }
};

/**
 * 分析を実行（非同期）
 */
async function runAnalysis(runId, { pcFileKey, spFileKey, pcPageName, spPageName, components }) {
    try {
          // 1. Figmaファイルを取得
      const pcFile = await getFigmaFile(pcFileKey, pcPageName);
          const spFile = await getFigmaFile(spFileKey, spPageName);

      const results = [];
          const inconsistencies = [];

      // 2. 各コンポーネントを分析
      for (const componentType of components) {
              const guidelines = getGuidelines(componentType);

            // PCコンポーネントを検索
            const pcComponents = findComponents(pcFile, componentType);
              // SPコンポーネントを検索
            const spComponents = findComponents(spFile, componentType);

            // PC/SP矛盾を検知
            const detected = detectInconsistencies(pcComponents, spComponents, componentType);
              inconsistencies.push(...detected);

            // PCコンポーネントを分析
            for (const component of pcComponents) {
                      const imageUrl = await getFigmaImage(pcFileKey, component.id);
                      const analysis = await analyzeWithClaude(imageUrl, componentType, guidelines);

                results.push({
                            runId,
                            componentType,
                            componentName: component.name,
                            deviceType: 'pc',
                            imageUrl,
                            frameName: component.frameName,
                            ...analysis
                });
            }

            // SPコンポーネントを分析
            for (const component of spComponents) {
                      const imageUrl = await getFigmaImage(spFileKey, component.id);
                      const analysis = await analyzeWithClaude(imageUrl, componentType, guidelines);

                results.push({
                            runId,
                            componentType,
                            componentName: component.name,
                            deviceType: 'sp',
                            imageUrl,
                            frameName: component.frameName,
                            ...analysis
                });
            }
      }

      // 3. 結果をデータベースに保存
      for (const result of results) {
              await createAnalysisResult(result);
      }

      for (const inconsistency of inconsistencies) {
              await createInconsistency({ runId, ...inconsistency });
      }

      // 4. ステータスを更新
      await updateAnalysisRunStatus(runId, 'completed');

    } catch (error) {
          console.error('Analysis execution failed:', error);
          throw error;
    }
}

/**
 * コンポーネントを検索
 */
function findComponents(file, componentType) {
    const components = [];
    const searchPatterns = getSearchPatterns(componentType);

  function traverse(node, frameName = null) {
        // フレーム名を追跡
      const currentFrameName = node.type === 'FRAME' ? node.name : frameName;

      // コンポーネント名がパターンに一致するか確認
      if (node.name && searchPatterns.some(pattern => node.name.match(pattern))) {
              components.push({
                        id: node.id,
                        name: node.name,
                        frameName: currentFrameName
              });
      }

      // 子要素を再帰的に探索
      if (node.children) {
              for (const child of node.children) {
                        traverse(child, currentFrameName);
              }
      }
  }

  traverse(file.document);
    return components;
}

/**
 * 検索パターンを取得
 */
function getSearchPatterns(componentType) {
    const patterns = {
          toast: [/toast/i, /トースト/i],
          accordion: [/accordion/i, /アコーディオン/i],
          bottomsheet: [/bottom.*sheet/i, /ボトムシート/i]
    };
    return patterns[componentType] || [];
}

/**
 * PC/SP間の矛盾を検知
 */
function detectInconsistencies(pcComponents, spComponents, componentType) {
    const inconsistencies = [];

  // 存在の矛盾: PCにあってSPにない、またはその逆
  const pcNames = new Set(pcComponents.map(c => c.name.toLowerCase()));
    const spNames = new Set(spComponents.map(c => c.name.toLowerCase()));

  // PCにあってSPにない
  for (const pcName of pcNames) {
        if (!spNames.has(pcName)) {
                inconsistencies.push({
                          componentType,
                          type: 'existence',
                          severity: 'high',
                          description: `PCには「${pcName}」が存在しますが、SPには存在しません`,
                          recommendation: 'SP版のデザインを追加してください',
                          pcComponent: pcName
                });
        }
  }

  // SPにあってPCにない
  for (const spName of spNames) {
        if (!pcNames.has(spName)) {
                inconsistencies.push({
                          componentType,
                          type: 'existence',
                          severity: 'high',
                          description: `SPには「${spName}」が存在しますが、PCには存在しません`,
                          recommendation: 'PC版のデザインを追加してください',
                          spComponent: spName
                });
        }
  }

  return inconsistencies;
}
