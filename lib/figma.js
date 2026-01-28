// Figma API クライアント

const FIGMA_API_BASE = 'https://api.figma.com/v1';

/**
 * Figmaファイルの情報を取得
 */
async function getFile(fileKey, accessToken) {
    const url = `${FIGMA_API_BASE}/files/${fileKey}`;

  const response = await fetch(url, {
        headers: {
                'X-Figma-Token': accessToken
        }
  });

  if (!response.ok) {
        throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * 特定のコンポーネント（Toast, Accordion, Bottomsheetなど）を検索
 */
function findComponentsByName(fileData, componentName, pageName = null) {
    const components = [];

  function traverse(node, frameName = null) {
        // ページ名フィルタ
      if (pageName && node.type === 'CANVAS' && node.name !== pageName) {
              return;
      }

      // フレーム名を追跡（画面フロー分析のため）
      let currentFrameName = frameName;
        if (node.type === 'FRAME' && node.name) {
                currentFrameName = node.name;
        }

      // コンポーネント検索（名前の部分一致）
      const searchPattern = new RegExp(componentName, 'i');
        if (node.name && searchPattern.test(node.name)) {
                components.push({
                          id: node.id,
                          name: node.name,
                          type: node.type,
                          frameName: currentFrameName,
                          pageName: node.type === 'CANVAS' ? node.name : null,
                          x: node.absoluteBoundingBox?.x,
                          y: node.absoluteBoundingBox?.y,
                          width: node.absoluteBoundingBox?.width,
                          height: node.absoluteBoundingBox?.height,
                          node: node // 詳細情報用
                });
        }

      // 子要素を再帰的に検索
      if (node.children) {
              for (const child of node.children) {
                        traverse(child, currentFrameName);
              }
      }
  }

  traverse(fileData.document);
    return components;
}

/**
 * ノードの画像URLを取得
 */
async function getImageUrls(fileKey, nodeIds, accessToken) {
    const ids = nodeIds.join(',');
    const url = `${FIGMA_API_BASE}/images/${fileKey}?ids=${ids}&format=png&scale=2`;

  const response = await fetch(url, {
        headers: {
                'X-Figma-Token': accessToken
        }
  });

  if (!response.ok) {
        throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * テキストコンテンツを抽出（Toast/Accordionのメッセージなど）
 */
function extractTextContent(node) {
    const texts = [];

  function traverse(n) {
        if (n.type === 'TEXT' && n.characters) {
                texts.push(n.characters);
        }
        if (n.children) {
                for (const child of n.children) {
                          traverse(child);
                }
        }
  }

  traverse(node);
    return texts.join(' ');
}

/**
 * コンポーネントの詳細情報を抽出
 */
function extractComponentDetails(component) {
    const node = component.node;

  return {
        id: component.id,
        name: component.name,
        frameName: component.frameName,
        pageName: component.pageName,
        position: {
                x: component.x,
                y: component.y,
                width: component.width,
                height: component.height
        },
        textContent: extractTextContent(node),
        // Toast特有の情報
        fills: node.fills,
        effects: node.effects,
        // 子要素の数（複雑度の指標）
        childCount: node.children ? node.children.length : 0
  };
}

/**
 * メイン処理：コンポーネントを検索して画像URLと詳細情報を取得
 */
async function analyzeComponents(fileKey, componentName, pageName, accessToken) {
    // 1. ファイルデータ取得
  const fileData = await getFile(fileKey, accessToken);

  // 2. コンポーネント検索
  const components = findComponentsByName(fileData, componentName, pageName);

  if (components.length === 0) {
        return {
                fileKey,
                componentName,
                pageName,
                components: [],
                message: 'コンポーネントが見つかりませんでした'
        };
  }

  // 3. 画像URL取得
  const nodeIds = components.map(c => c.id);
    const imageData = await getImageUrls(fileKey, nodeIds, accessToken);

  // 4. 詳細情報を統合
  const results = components.map(component => {
        const details = extractComponentDetails(component);
        return {
                ...details,
                imageUrl: imageData.images[component.id] || null
        };
  });

  return {
        fileKey,
        componentName,
        pageName,
        fileName: fileData.name,
        components: results,
        totalCount: results.length
  };
}

module.exports = {
    getFile,
    findComponentsByName,
    getImageUrls,
    extractTextContent,
    extractComponentDetails,
    analyzeComponents
};
