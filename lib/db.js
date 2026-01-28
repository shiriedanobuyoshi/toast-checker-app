import { sql } from '@vercel/postgres';

/**
 * データベーススキーマを初期化
 */
export async function initDatabase() {
    try {
          // analysis_runs テーブル
      await sql`
            CREATE TABLE IF NOT EXISTS analysis_runs (
                    id SERIAL PRIMARY KEY,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                    status VARCHAR(20) NOT NULL,
                                            trigger VARCHAR(20) NOT NULL,
                                                    pc_file_key VARCHAR(255) NOT NULL,
                                                            sp_file_key VARCHAR(255) NOT NULL,
                                                                    pc_page_name VARCHAR(255),
                                                                            sp_page_name VARCHAR(255),
                                                                                    components TEXT[] NOT NULL,
                                                                                            total_pc INTEGER DEFAULT 0,
                                                                                                    total_sp INTEGER DEFAULT 0,
                                                                                                            total_inconsistencies INTEGER DEFAULT 0,
                                                                                                                    average_pc_score FLOAT,
                                                                                                                            average_sp_score FLOAT
                                                                                                                                  )
                                                                                                                                      `;

      // analysis_results テーブル
      await sql`
            CREATE TABLE IF NOT EXISTS analysis_results (
                    id SERIAL PRIMARY KEY,
                            run_id INTEGER REFERENCES analysis_runs(id) ON DELETE CASCADE,
                                    component_type VARCHAR(50) NOT NULL,
                                            component_name VARCHAR(255) NOT NULL,
                                                    device_type VARCHAR(10) NOT NULL,
                                                            image_url TEXT NOT NULL,
                                                                    compliance_score INTEGER NOT NULL,
                                                                            extracted_content TEXT,
                                                                                    action_type VARCHAR(255),
                                                                                            placement VARCHAR(50),
                                                                                                    frame_name VARCHAR(255),
                                                                                                            violations JSONB,
                                                                                                                    recommendations JSONB,
                                                                                                                            flow_analysis TEXT,
                                                                                                                                    summary TEXT
                                                                                                                                          )
                                                                                                                                              `;

      // inconsistencies テーブル
      await sql`
            CREATE TABLE IF NOT EXISTS inconsistencies (
                    id SERIAL PRIMARY KEY,
                            run_id INTEGER REFERENCES analysis_runs(id) ON DELETE CASCADE,
                                    component_type VARCHAR(50) NOT NULL,
                                            type VARCHAR(50) NOT NULL,
                                                    severity VARCHAR(20) NOT NULL,
                                                            description TEXT NOT NULL,
                                                                    recommendation TEXT NOT NULL,
                                                                            pc_component VARCHAR(255),
                                                                                    sp_component VARCHAR(255),
                                                                                            pc_content TEXT,
                                                                                                    sp_content TEXT,
                                                                                                            action_type VARCHAR(255)
                                                                                                                  )
                                                                                                                      `;

      console.log('Database initialized successfully');
    } catch (error) {
          console.error('Database initialization error:', error);
          throw error;
    }
}

/**
 * 新しい分析実行を作成
 */
export async function createAnalysisRun(data) {
    const { trigger, pcFileKey, spFileKey, pcPageName, spPageName, components } = data;

  const result = await sql`
      INSERT INTO analysis_runs (status, trigger, pc_file_key, sp_file_key, pc_page_name, sp_page_name, components)
          VALUES ('running', ${trigger}, ${pcFileKey}, ${spFileKey}, ${pcPageName || null}, ${spPageName || null}, ${components})
              RETURNING id
                `;

  return result.rows[0].id;
}

/**
 * 分析実行のステータスを更新
 */
export async function updateAnalysisRunStatus(runId, status, stats = {}) {
    await sql`
        UPDATE analysis_runs
            SET 
                  status = ${status},
                        total_pc = ${stats.totalPc || 0},
                              total_sp = ${stats.totalSp || 0},
                                    total_inconsistencies = ${stats.totalInconsistencies || 0},
                                          average_pc_score = ${stats.averagePcScore || null},
                                                average_sp_score = ${stats.averageSpScore || null}
                                                    WHERE id = ${runId}
                                                      `;
}

/**
 * 分析結果を保存
 */
export async function saveAnalysisResult(runId, result) {
    await sql`
        INSERT INTO analysis_results (
              run_id, component_type, component_name, device_type, image_url,
                    compliance_score, extracted_content, action_type, placement, frame_name,
                          violations, recommendations, flow_analysis, summary
                              )
                                  VALUES (
                                        ${runId}, ${result.componentType}, ${result.name}, ${result.deviceType}, ${result.imageUrl},
                                              ${result.analysis.compliance_score}, ${result.analysis.extracted_content || null}, 
                                                    ${result.analysis.action_type || null}, ${result.analysis.placement}, ${result.analysis.frame_name || null},
                                                          ${JSON.stringify(result.analysis.violations || [])}, 
                                                                ${JSON.stringify(result.analysis.recommendations || [])},
                                                                      ${result.analysis.flow_analysis || null}, ${result.analysis.summary}
                                                                          )
                                                                            `;
}

/**
 * 矛盾を保存
 */
export async function saveInconsistency(runId, componentType, inconsistency) {
    await sql`
        INSERT INTO inconsistencies (
              run_id, component_type, type, severity, description, recommendation,
                    pc_component, sp_component, pc_content, sp_content, action_type
                        )
                            VALUES (
                                  ${runId}, ${componentType}, ${inconsistency.type}, ${inconsistency.severity},
                                        ${inconsistency.description}, ${inconsistency.recommendation},
                                              ${inconsistency.pc_component || null}, ${inconsistency.sp_component || null},
                                                    ${inconsistency.pc_content || null}, ${inconsistency.sp_content || null},
                                                          ${inconsistency.action_type || null}
                                                              )
                                                                `;
}

/**
 * 全ての分析実行を取得
 */
export async function getAllAnalysisRuns() {
    const result = await sql`
        SELECT * FROM analysis_runs
            ORDER BY created_at DESC
              `;
    return result.rows;
}

/**
 * 特定の分析実行を取得
 */
export async function getAnalysisRun(runId) {
    const runResult = await sql`
        SELECT * FROM analysis_runs WHERE id = ${runId}
          `;

  if (runResult.rows.length === 0) {
        return null;
  }

  const run = runResult.rows[0];

  // 結果を取得
  const resultsResult = await sql`
      SELECT * FROM analysis_results WHERE run_id = ${runId}
          ORDER BY component_type, device_type, component_name
            `;

  // 矛盾を取得
  const inconsistenciesResult = await sql`
      SELECT * FROM inconsistencies WHERE run_id = ${runId}
          ORDER BY severity DESC, component_type
            `;

  return {
        ...run,
        results: resultsResult.rows,
        inconsistencies: inconsistenciesResult.rows
  };
}
