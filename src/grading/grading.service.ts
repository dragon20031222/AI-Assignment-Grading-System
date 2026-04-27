import { Injectable } from '@nestjs/common';
import * as https from 'https';

/**
 * AI批改请求接口
 * 封装传递给AI进行批改的所有信息
 */
export interface GradingRequest {
  /** 作业ID */
  assignment_id: number;
  /** 作业标题 */
  title: string;
  /** 作业描述 */
  description: string;
  /** 作业类型 */
  type: string;
  /** AI批改的评判标准（提示词） */
  grading_criteria: string;
  /** 题目列表 */
  questions: {
    id: number;
    type: string;
    description: string;
    options?: string[];
    correct_answer?: string;
    score: number;
  }[];
  /** 学生的答案（可能是文字或图片URL） */
  answers: object;
}

/**
 * AI批改结果接口
 * AI返回的批改结果结构
 */
export interface GradingResult {
  /** 是否成功 */
  success: boolean;
  /** 总分（成功时返回） */
  score?: number;
  /** 总体评语（成功时返回） */
  comment?: string;
  /** 详细批改结果，包含每道题的得分和评语（成功时返回） */
  details?: object;
  /** 错误信息（失败时返回） */
  error?: string;
}

/**
 * AI批改服务
 * 负责调用AI模型对学生的作业进行自动批改
 */
@Injectable()
export class GradingService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    this.apiKey = process.env.ALIYUN_API_KEY || '';
    this.baseUrl = process.env.ALIYUN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.model = process.env.ALIYUN_MODEL || 'qwen-vl-plus';
  }

  /**
   * 对作业进行批改的主方法
   * @param request - 包含作业信息和学生答案的请求对象
   * @returns 批改结果，包含分数、评语等
   */
  async gradeAssignment(request: GradingRequest): Promise<GradingResult> {
    try {
      const messages = this.buildMessages(request);

      const response = await this.callAliyunAPI(messages);

      if (response.error) {
        return {
          success: false,
          error: response.error.message || 'AI批改失败',
        };
      }

      const result = this.parseAIResponse(response);
      return {
        success: true,
        score: result.score,
        comment: result.comment,
        details: result.details,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'AI批改失败',
      };
    }
  }

  /**
   * 构建发送给AI的消息
   * 处理包含图片的答案
   */
  private buildMessages(request: GradingRequest) {
    const { title, description, type, grading_criteria, questions, answers } = request;

    let systemPrompt = 
            `你是一位网络工程专业的作业批改老师，十分熟悉网络工程相关知识，比如说计算机网络原理、网络协议、网络管理与维护等。
            负责批改学生的作业。包括客观题，主观题，混合题型，作业提交的形式很多，比如文字、图片、选择选项等等。
            请根据题目要求和学生答案给出公正、客观的评价，评判的时候酌情给分，不需要太严格，能区分好坏就行。

            评判标准：${grading_criteria || '按照标准答案进行评判'}

            作业类型：${type === 'subjective' ? '主观题' : type === 'objective' ? '客观题' : '混合题型'}

            请返回JSON格式的批改结果：
            {
              "score": 总分（数值）,
              "comment": 总体评语（字符串）,
              "details": {
                "题目ID": {
                  "score": 得分（数值）,
                  "comment": 评语（字符串）
                }
              }
            }`;

    let userContent = `作业标题：${title}\n作业描述：${description || '无'}\n\n`;

    userContent += `题目列表：\n`;
    questions.forEach((q, index) => {
      userContent += `${index + 1}. [${q.type === 'subjective' ? '主观题' : '客观题'}] ${q.description}\n`;
      if (q.options && q.options.length > 0) {
        userContent += `   选项：${q.options.join(', ')}\n`;
      }
      if (q.correct_answer) {
        userContent += `   正确答案：${q.correct_answer}\n`;
      }
      userContent += `   分值：${q.score}分\n\n`;
    });

    userContent += `\n学生答案：\n`;
    const answersObj = answers as Record<string, any>;
    const contentParts: any[] = [];

    Object.keys(answersObj).forEach((questionId) => {
      const answer = answersObj[questionId];
      const question = questions.find((q) => q.id === parseInt(questionId));

      let questionText = `\n题目${questionId}（${question?.type === 'subjective' ? '主观题' : '客观题'}，${question?.score || 0}分）\n`;
      questionText += `题目描述：${question?.description || '无描述'}\n`;

      if (question?.options && question.options.length > 0) {
        questionText += `题目选项：${question.options.join(', ')}\n`;
      }

      contentParts.push({
        type: 'text',
        text: questionText,
      });

      if (Array.isArray(answer)) {
        // 数组格式的答案
        for (const item of answer) {
          if (this.isImageUrl(item)) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: item },
            });
          } else {
            contentParts.push({
              type: 'text',
              text: String(item),
            });
          }
        }
      } else if (this.isImageUrl(answer)) {
        // 单个图片答案
        contentParts.push({
          type: 'image_url',
          image_url: { url: answer },
        });
      } else {
        // 文字答案
        contentParts.push({
          type: 'text',
          text: String(answer),
        });
      }
    });

    contentParts.push({
      type: 'text',
      text: `\n\n请根据以上信息批改作业，只返回JSON格式的批改结果，不要包含其他内容。`,
    });

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contentParts },
    ];
  }

  /**
   * 判断是否为图片URL
   */
  private isImageUrl(value: any): boolean {
    if (typeof value !== 'string') return false;
    return value.startsWith('http://') || value.startsWith('https://');
  }

  /**
   * 调用阿里云通义千问API
   */
  private async callAliyunAPI(messages: any[]): Promise<any> {
    const url = `${this.baseUrl}/chat/completions`;

    const body = JSON.stringify({
      model: this.model,
      messages: messages,
      stream: false,
    });

    console.log('\n========== AI 请求信息 ==========');
    console.log('📤 发送请求到:', url);
    console.log('📋 请求体:', body);
    console.log('================================\n');

    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            console.log('\n========== AI 响应信息 ==========');
            console.log('📥 收到响应:', JSON.stringify(parsed, null, 2));
            console.log('==================================\n');
            resolve(parsed);
          } catch (e) {
            reject(new Error('解析AI响应失败'));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`API调用失败: ${e.message}`));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * 解析AI返回的结果
   */
  private parseAIResponse(response: any): any {
    try {
      const content = response.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('AI返回内容为空');
      }

      // 尝试提取JSON
      let jsonStr = content.trim();

      // 尝试找到JSON对象
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const result = JSON.parse(jsonStr);

      return {
        score: result.score || 0,
        comment: result.comment || '批改完成',
        details: result.details || {},
      };
    } catch (error) {
      throw new Error(`解析批改结果失败: ${error.message}`);
    }
  }
}