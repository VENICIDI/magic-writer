export const EXTRACT_SYSTEM = `你是一位专业的小说分析师。
你的任务是从小说片段中同时提取四类信息：主线剧情、世界观设定、角色、物品。
只依据文本内容，不要臆造。如果片段中未提及某类信息，对应字段留空列表。
输出必须是合法 JSON，不要包含 markdown 代码块。
字符串内的双引号须用 \\" 转义；摘要与描述尽量简洁（单条不超过 80 字），确保 JSON 完整闭合。`;

function jsonEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

export function extractUser(params: {
  chunkTitle: string;
  chunkIndex: number;
  totalChunks: number;
  totalChars: number;
  chunkText: string;
}): string {
  return `请分析以下小说片段，提取主线、世界观、角色、物品四类信息。

【片段标题】${params.chunkTitle}
【片段序号】${params.chunkIndex} / ${params.totalChunks}
【小说总字数约】${params.totalChars}

【片段正文】
${params.chunkText}

请输出 JSON，结构如下：
{
  "chunk_index": ${params.chunkIndex},
  "chunk_title": "${jsonEscape(params.chunkTitle)}",
  "plot_events": [
    {"summary": "情节摘要", "type": "主线/支线/伏笔/转折", "characters": ["涉及角色"]}
  ],
  "geography": ["地点、地形、国家、城市..."],
  "factions": ["势力、组织、门派、国家阵营..."],
  "power_system": ["修炼体系、等级、能力规则..."],
  "races_species": ["种族、物种、血脉..."],
  "history_events": ["历史事件、传说、战争..."],
  "rules_laws": ["世界法则、禁忌、天道规则..."],
  "technology_magic": ["科技水平、魔法、法宝体系、阵法..."],
  "culture_religion": ["文化、宗教、习俗、信仰..."],
  "key_entities": [
    {"name": "名称", "category": "地点/概念", "description": "简述", "aliases": []}
  ],
  "characters": [
    {
      "name": "角色名",
      "aliases": ["别名"],
      "role": "主角/配角/反派/路人",
      "description": "外貌、性格、身份简述",
      "relationships": ["与其他角色的关系"],
      "abilities": ["能力、功法、特长"],
      "development": ["本片段中的行为、成长、变化"]
    }
  ],
  "items": [
    {
      "name": "物品名",
      "aliases": ["别名"],
      "category": "武器/法宝/丹药/功法/其他",
      "description": "外观与功能简述",
      "owner": "持有者或归属",
      "abilities": ["功效、能力"],
      "significance": "在剧情或世界观中的意义"
    }
  ],
  "timeline_notes": ["时间线线索，注明相对/绝对时间若可知"],
  "open_questions": ["本片段中未能确定、需后续片段验证的疑点"]
}`;
}

export const MERGE_SYSTEM = `你是小说分析整合专家。
你将收到多段从同一部小说中抽取的分析结果，请去重、合并、消解别名，输出统一结构。
主线按时间顺序梳理；角色与物品需合并同名实体的全部信息；世界观要素去重合并。
标注可能的矛盾点。输出合法 JSON，不要 markdown 代码块。
字符串内的双引号须转义；确保 JSON 完整闭合。`;

export function mergeUser(chunkCount: number, extractionsJson: string): string {
  return `以下是从小说各片段提取的分析结果（共 ${chunkCount} 段）。
请合并为统一草稿。

【各段提取结果】
${extractionsJson}

输出 JSON 结构：
{
  "main_plot": {
    "overview": "主线剧情一句话概括",
    "arcs": [{"name": "篇章/阶段名", "summary": "该阶段概述", "events": ["关键事件"]}],
    "key_turning_points": ["重大转折点"],
    "conflicts": ["核心矛盾与冲突"],
    "foreshadowing": ["伏笔与呼应"],
    "unresolved_threads": ["未解悬念"],
    "timeline": ["按时间顺序的主线事件"]
  },
  "geography": [],
  "factions": [],
  "power_system": [],
  "races_species": [],
  "history_timeline": [],
  "rules_laws": [],
  "technology_magic": [],
  "culture_religion": [],
  "key_entities": [
    {"name": "", "category": "地点/概念", "description": "", "aliases": [], "first_mention_chunk": null}
  ],
  "characters": [
    {
      "name": "",
      "aliases": [],
      "role": "",
      "description": "",
      "relationships": [],
      "abilities": [],
      "development": [],
      "first_mention_chunk": null
    }
  ],
  "items": [
    {
      "name": "",
      "aliases": [],
      "category": "",
      "description": "",
      "owner": "",
      "abilities": [],
      "significance": "",
      "first_mention_chunk": null
    }
  ],
  "contradictions": ["不同片段间的矛盾或待核实点"],
  "confidence_notes": ["信息完整度、推断依据说明"]
}`;
}

export const SYNTHESIZE_SYSTEM = `你是资深文学策划顾问。
请基于已整合的分析素材，撰写一份完整、可读的小说分析报告（Markdown）。
报告须涵盖主线、世界观、角色、物品四大板块，结构清晰、层次分明。
区分「已证实设定」与「合理推断」。使用中文。`;

export function synthesizeUser(params: {
  title: string;
  totalChars: number;
  chunkCount: number;
  mergedJson: string;
}): string {
  return `请为以下小说撰写完整分析报告。

【小说标题】${params.title}
【总字数】${params.totalChars}
【分析块数】${params.chunkCount}

【已整合分析素材】
${params.mergedJson}

请输出完整 Markdown 报告，必须包含以下四大板块：

## 一、主线剧情
- 剧情总览（一句话 + 一段话）
- 分阶段叙事（按篇章/弧）
- 关键转折点
- 核心矛盾与冲突
- 伏笔与悬念
- 时间线梳理

## 二、世界观
- 世界观总览
- 世界结构与地理
- 历史与时间线
- 力量体系 / 科技魔法
- 种族与社会结构
- 势力与政治格局
- 文化、宗教与价值观
- 核心规则与禁忌
- 关键地点与概念百科

## 三、角色
- 角色总览（主要角色关系简述）
- 主要角色档案（每人：身份、性格、能力、关系、成长弧）
- 次要角色索引

## 四、物品
- 物品总览（重要道具/法宝体系简述）
- 重要物品档案（每件：类别、描述、持有者、能力、剧情意义）
- 物品索引表

## 附录
- 待核实矛盾与开放问题
- 分析置信度说明

直接输出 Markdown，不要用 JSON 包裹。`;
}

export const BATCH_MERGE_SYSTEM = `你是小说分析整合专家。你正在处理超长小说的分批合并。
将本批提取结果合并为中间摘要，保留所有独特信息，去除明显重复。
主线、角色、物品、世界观四类信息均需合并。
输出合法 JSON；字符串内的双引号须转义；确保 JSON 完整闭合。`;

export function batchMergeUser(count: number, extractionsJson: string): string {
  return `合并以下 ${count} 段分析结果为中间摘要 JSON。
结构与单段提取相同：plot_events、世界观字段、characters、items 均需去重合并。

【提取结果】
${extractionsJson}

输出合法 JSON。`;
}
