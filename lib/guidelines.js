// lib/guidelines.js - コンポーネントガイドライン定義

/**
 * Toast コンポーネントのガイドライン
 * 出典: Loopガイドライン
 */
export const TOAST_GUIDELINES = {
    // 使用条件
    usage: {
          when: [
                  'ユーザーのアクションに対する結果を伝える',
                  'システムの状態変化を通知する',
                  '一時的な情報を表示する'
                ],
          whenNot: [
                  '重要な警告やエラー（モーダルを使用）',
                  '長い文章の表示',
                  'ユーザーの操作を必要とする内容'
                ]
    },

    // 表示位置
    placement: {
      default: '画面上部中央',
          alternatives: ['画面下部'],
          prohibited: ['画面の端', '操作の邪魔になる位置']
    },

    // メッセージ
    message: {
          maxLength: 40,
          tone: '簡潔で明確',
          format: [
                  '「〜しました」の完了形',
                  '主語は省略可',
                  '専門用語は避ける'
                ],
          examples: {
                  good: [
                            '保存しました',
                            '削除しました',
                            'コピーしました'
                          ],
                  bad: [
                            'データベースへの保存処理が正常に完了しました',
                            '削除',
                            'OK'
                          ]
          }
    },

    // タイプ
    types: {
          success: {
                  color: 'green',
                  icon: 'check-circle',
                  usage: '操作が成功した時'
          },
          error: {
                  color: 'red',
                  icon: 'x-circle',
                  usage: '操作が失敗した時'
          },
          info: {
                  color: 'blue',
                  icon: 'info-circle',
                  usage: '情報を伝える時'
          },
          warning: {
                  color: 'yellow',
                  icon: 'alert-triangle',
                  usage: '注意を促す時'
          }
    },

    // 表示時間
    duration: {
      default: 3000,
          min: 2000,
          max: 5000,
          autoClose: true
    },

    // アクション
    actions: {
          maxActions: 1,
          types: ['閉じる', '元に戻す', '詳細を見る'],
          placement: 'メッセージの右側'
    },

    // PC/SP差分
    deviceDifferences: {
          pc: {
                  width: '固定幅（400px推奨）',
                  position: '画面上部中央'
          },
          sp: {
                  width: '画面幅いっぱい',
                  position: '画面上部'
          }
    }
};

/**
 * Accordion コンポーネントのガイドライン
 */
export const ACCORDION_GUIDELINES = {
    usage: {
          when: [
                  '長いコンテンツを整理する',
                  'FAQ形式の情報表示',
                  '段階的な情報開示'
                ],
          whenNot: [
                  '重要な情報の隠蔽',
                  '2つ以下の項目',
                  'ナビゲーション用途'
                ]
    },

    structure: {
          header: {
                  height: { pc: '48px', sp: '56px' },
                  icon: 'chevron-down',
                  alignment: 'left'
          },
          content: {
                  padding: { pc: '16px', sp: '12px' },
                  animation: 'smooth expand/collapse'
          }
    },

    behavior: {
          defaultState: 'collapsed',
          multiOpen: true,
          clickTarget: 'ヘッダー全体'
    },

    deviceDifferences: {
          pc: { hoverState: true },
          sp: { hoverState: false, tapHighlight: true }
    }
};

/**
 * Bottomsheet コンポーネントのガイドライン
 */
export const BOTTOMSHEET_GUIDELINES = {
    usage: {
          when: [
                  'モバイルでの追加情報表示',
                  'アクションメニュー',
                  'フォーム入力'
                ],
          whenNot: [
                  'PCでの使用（モーダル推奨）',
                  '全画面表示が必要な内容',
                  '複雑な操作フロー'
                ]
    },

    dimensions: {
          maxHeight: '90vh',
          minHeight: '200px',
          borderRadius: '16px 16px 0 0'
    },

    behavior: {
          openAnimation: 'slide-up',
          closeOn: ['背景タップ', 'スワイプダウン', '閉じるボタン'],
          backdrop: 'semi-transparent (rgba(0,0,0,0.5))'
    },

    deviceDifferences: {
          pc: { notRecommended: true, alternative: 'Modal' },
          sp: { recommended: true }
    }
};

/**
 * ガイドラインに基づいて違反をチェック
 */
export function checkGuideline(componentType, analysis) {
    const guidelines = {
          toast: TOAST_GUIDELINES,
          accordion: ACCORDION_GUIDELINES,
          bottomsheet: BOTTOMSHEET_GUIDELINES
    }[componentType];

  if (!guidelines) return { violations: [], score: 100 };

  const violations = [];
    let score = 100;

  // Toastのガイドラインチェック
  if (componentType === 'toast') {
        // メッセージ長チェック
      if (analysis.extractedContent?.length > guidelines.message.maxLength) {
              violations.push(`メッセージが長すぎます（${analysis.extractedContent.length}文字 > ${guidelines.message.maxLength}文字）`);
              score -= 20;
      }

      // タイプチェック
      const validTypes = Object.keys(guidelines.types);
        if (analysis.type && !validTypes.includes(analysis.type)) {
                violations.push(`無効なタイプ: ${analysis.type}`);
                score -= 15;
        }

      // 配置チェック
      const validPlacements = [guidelines.placement.default, ...guidelines.placement.alternatives];
        if (analysis.placement && !validPlacements.some(p => 
                                                              analysis.placement.toLowerCase().includes(p.toLowerCase())
                                                            )) {
                violations.push(`推奨されない配置: ${analysis.placement}`);
                score -= 10;
        }
  }

  // Accordionのガイドラインチェック
  if (componentType === 'accordion') {
        // 構造チェック
      if (!analysis.hasHeader) {
              violations.push('ヘッダーが見つかりません');
              score -= 25;
      }

      if (!analysis.hasIcon) {
              violations.push('展開/折りたたみアイコンが見つかりません');
              score -= 15;
      }
  }

  // Bottomsheetのガイドラインチェック
  if (componentType === 'bottomsheet') {
        // デバイスチェック
      if (analysis.deviceType === 'pc') {
              violations.push('PCでのBottomsheet使用は推奨されません（Modalを使用してください）');
              score -= 30;
      }

      // 高さチェック
      if (analysis.height && analysis.height > guidelines.dimensions.maxHeight) {
              violations.push(`高さが最大値を超えています: ${analysis.height}`);
              score -= 20;
      }
  }

  return {
        violations,
        score: Math.max(0, score)
  };
}

/**
 * 推奨事項を生成
 */
export function generateRecommendations(componentType, violations) {
    const recommendations = [];

  violations.forEach(violation => {
        if (violation.includes('メッセージが長すぎます')) {
                recommendations.push('メッセージを40文字以内に短縮してください');
                recommendations.push('詳細情報は別途モーダルやリンクで提供することを検討してください');
        }

                         if (violation.includes('推奨されない配置')) {
                                 recommendations.push('Toastは画面上部中央または下部に配置してください');
                         }

                         if (violation.includes('無効なタイプ')) {
                                 recommendations.push('success/error/info/warningのいずれかを使用してください');
                         }

                         if (violation.includes('PCでのBottomsheet')) {
                                 recommendations.push('PCではModalコンポーネントの使用を検討してください');
                         }

                         if (violation.includes('ヘッダーが見つかりません')) {
                                 recommendations.push('Accordionには必ずヘッダーを含めてください');
                         }
  });

  return recommendations;
}
