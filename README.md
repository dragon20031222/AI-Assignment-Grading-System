# AI作业批改系统 - 后端服务

> **基于 NestJS 框架的全栈式智能作业管理平台后端**
>
> 支持教师发布作业、学生在线作答、AI自动批改、图片查重、成绩统计分析等功能

---

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 技术栈](#2-技术栈)
- [3. 系统架构设计](#3-系统架构设计)
- [4. 数据库设计](#4-数据库设计)
- [5. 模块详细设计](#5-模块详细设计)
  - [5.1 用户模块 (User Module)](#51-用户模块-user-module)
  - [5.2 认证模块 (Auth Module)](#52-认证模块-auth-module)
  - [5.3 班级模块 (Class Module)](#53-班级模块-class-module)
  - [5.4 作业模块 (Assignment Module)](#54-作业模块-assignment-module)
  - [5.5 AI批改模块 (Grading Module)](#55-ai批改模块-grading-module)
  - [5.6 文件上传模块 (Upload Module)](#56-文件上传模块-upload-module)
  - [5.7 成绩管理模块 (Score Module)](#57-成绩管理模块-score-module)
  - [5.8 公共模块 (Common Module)](#58-公共模块-common-module)
- [6. API接口文档](#6-api接口文档)
- [7. 关键技术与难点解析](#7-关键技术与难点解析)
- [8. 安全性设计](#8-安全性设计)
- [9. 部署与运行](#9-部署与运行)

---

## 1. 项目概述

### 1.1 项目背景

传统的作业批改依赖教师人工完成，效率低下且主观性强。本系统旨在利用人工智能技术，实现作业的自动批改与智能分析，减轻教师工作负担，提高教学效率。

### 1.2 核心功能

| 角色 | 功能 |
|------|------|
| **教师** | 创建班级、发布作业、查看提交情况、查看AI批改结果、成绩统计与分析 |
| **学生** | 加入班级、查看作业列表、在线答题（文字/图片）、查看AI评分与评语、查看成绩排名 |
| **系统** | AI自动批改、图片查重检测、数据统计、日志记录 |

### 1.3 系统工作流程

```
教师创建班级 → 发布作业（含题目）→ 学生加入班级 → 学生在线答题提交
    → 图片查重检测 → AI自动批改 → 教师/学生查看成绩与统计
```

---

## 2. 技术栈

### 2.1 后端核心技术

| 技术 | 版本 | 用途 |
|------|------|------|
| **NestJS** | 10.x | 后端框架，提供模块化、依赖注入、AOP编程等企业级特性 |
| **TypeScript** | 5.x | 编程语言，提供静态类型检查 |
| **TypeORM** | 0.3.x | ORM框架，实现对象关系映射 |
| **MySQL** | 8.x | 关系型数据库 |
| **Passport + JWT** | - | 用户认证与授权 |
| **bcrypt** | 6.x | 密码加密哈希 |
| **class-validator** | 0.15.x | DTO数据验证 |
| **class-transformer** | 0.5.x | 数据转换 |
| **multer** | 2.x | 文件上传中间件 |
| **sharp** | 0.34.x | 图片处理库 |
| **image-hash** | 7.x | 图片感知哈希计算（用于查重） |
| **winston** | 3.x | 日志系统 |
| **uuid** | 13.x | 唯一ID生成 |

### 2.2 外部AI服务

| 服务 | 用途 |
|------|------|
| **阿里云通义千问 (qwen-vl-plus)** | 多模态AI模型，支持文字+图片的作业批改 |

### 2.3 开发工具

| 工具 | 用途 |
|------|------|
| **pnpm/npm** | 包管理器 |
| **Nest CLI** | 脚手架工具 |
| **ts-jest** | 单元测试框架 |

---

## 3. 系统架构设计

### 3.1 整体架构

系统采用 **经典三层架构（Controller-Service-Repository）** ，结合 NestJS 的模块化设计：

```
┌─────────────────────────────────────────────────────┐
│                    HTTP 请求                          │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│              中间件层 (Middleware)                     │
│   LoggerMiddleware - 日志记录、脱敏、链路追踪           │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│              守卫层 (Guard)                           │
│   JwtAuthGuard - JWT Token 验证                      │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│              控制器层 (Controller)                     │
│   参数校验 (@Body/@Param)、路由分发、角色区分            │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│              拦截器层 (Interceptor)                    │
│   ResponseInterceptor - 统一响应格式包装               │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│              服务层 (Service)                         │
│   核心业务逻辑、权限验证、数据组装、AI调用编排           │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│              数据访问层 (Repository/TypeORM)           │
│   CRUD操作、复杂SQL查询、事务管理                      │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│              数据库 (MySQL)                           │
└─────────────────────────────────────────────────────┘
```

### 3.2 模块依赖关系

```
AppModule (根模块)
├── UserModule          ← 用户管理
├── AuthModule          ← 认证授权（依赖 UserModule）
├── ClassModule         ← 班级管理（依赖 UserModule）
├── AssignmentModule    ← 作业管理（依赖 GradingModule, UploadModule）
│   ├── GradingModule   ← AI批改
│   └── UploadModule    ← 文件上传
├── ScoreModule         ← 成绩统计（自包含）
└── Common Module       ← 公共组件（过滤器/拦截器/中间件）
```

### 3.3 目录结构

```
src/
├── main.ts                          # 应用入口，全局配置
├── app.module.ts                    # 根模块，汇总所有子模块
├── app.controller.ts                # 根控制器
├── app.service.ts                   # 根服务
├── auth/                            # 认证模块
│   ├── auth.module.ts
│   ├── auth.controller.ts           # 注册/登录接口
│   ├── auth.service.ts              # 认证业务逻辑
│   ├── decorators/
│   │   └── current-user.decorator.ts # @CurrentUser() 装饰器
│   ├── dto/
│   │   ├── login.dto.ts
│   │   └── register.dto.ts
│   ├── entities/
│   │   └── auth.entity.ts
│   ├── guards/
│   │   └── jwt-auth.guard.ts        # JWT认证守卫
│   └── strategies/
│       └── jwt.strategy.ts          # JWT验证策略
├── user/                            # 用户模块
│   ├── user.module.ts
│   ├── user.controller.ts
│   ├── user.service.ts              # 用户CRUD、密码加密
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   └── update-user.dto.ts
│   └── entities/
│       └── user.entity.ts           # 用户表实体
├── class/                           # 班级模块
│   ├── class.module.ts
│   ├── class.controller.ts
│   ├── class.service.ts             # 班级/学生/班长管理
│   ├── dto/
│   │   ├── create-class.dto.ts
│   │   └── join-class.dto.ts
│   └── entities/
│       ├── class-info.entity.ts     # 班级信息表
│       ├── class-student.entity.ts  # 学生-班级关联表
│       └── class-teacher.entity.ts  # 教师-班级关联表
├── assignment/                      # 作业模块
│   ├── assignment.module.ts
│   ├── assignment.controller.ts
│   ├── assignment.service.ts        # 作业CRUD、提交、查重、批改编排
│   ├── dto/
│   │   ├── create-assignment.dto.ts
│   │   ├── submit-assignment.dto.ts
│   │   └── update-assignment.dto.ts
│   └── entities/
│       ├── assignment.entity.ts     # 作业表
│       ├── assignment-submit.entity.ts # 提交记录表
│       ├── assignment-type.enum.ts  # 作业类型/提交状态枚举
│       └── question.entity.ts       # 题目表
├── grading/                         # AI批改模块
│   ├── grading.module.ts
│   └── grading.service.ts           # 阿里云千问API调用
├── upload/                          # 文件上传模块
│   ├── upload.module.ts
│   ├── upload.controller.ts
│   ├── upload.service.ts            # 文件存储管理
│   └── duplicate-check.service.ts   # 图片查重（感知哈希）
├── score/                           # 成绩管理模块
│   ├── score.module.ts
│   ├── score.controller.ts
│   ├── score.service.ts             # 成绩统计、排名计算
│   └── dto/
│       └── score.dto.ts             # 成绩数据传输对象
└── common/                          # 公共模块
    ├── dto/
    │   └── response.dto.ts          # 统一响应格式
    ├── filters/
    │   └── http-exception.filter.ts # 全局异常过滤器
    ├── interceptors/
    │   └── response.interceptor.ts  # 全局响应拦截器
    ├── logger/
    │   └── logger.config.ts         # 日志配置
    └── middleware/
        └── logger.middleware.ts      # 请求日志中间件
```

---

## 4. 数据库设计

### 4.1 ER图（实体关系）

```
┌──────────┐     ┌──────────────────┐     ┌──────────────┐
│   User   │     │   ClassTeacher    │     │   ClassInfo   │
│──────────│     │──────────────────│     │──────────────│
│ id (PK)  │◄────│ teacher_id (FK)  │────►│ id (PK)      │
│ username │     │ class_id (FK)    │     │ name         │
│ password │     │ is_main_teacher  │     │ description  │
│ role     │     └──────────────────┘     │ invite_code  │
│ name     │                              │ creator_id   │
│ email    │     ┌──────────────────┐     └──────┬───────┘
└────┬─────┘     │   ClassStudent   │            │
     │           │──────────────────│            │
     │           │ id (PK)          │            │
     │           │ class_id (FK)    ├────────────┘
     │           │ student_id (FK)  │
     │           │ is_monitor       │
     │           └──────────────────┘
     │
     │    ┌──────────────┐     ┌────────────────────┐
     │    │  Assignment  │     │ AssignmentSubmit    │
     │    │──────────────│     │────────────────────│
     │    │ id (PK)      │◄────│ assignment_id (FK) │
     │    │ title        │     │ student_id (FK)    │────► User
     │    │ description  │     │ answers (JSON)     │
     │    │ type         │     │ score              │
     │    │ deadline     │     │ comment            │
     │    │ class_id (FK)│     │ status (enum)      │
     └────│ creator_id   │     │ image_hashes (JSON)│
          └──────┬───────┘     │ ai_result          │
                 │             │ submitted_at       │
                 │             │ graded_at          │
                 │             └────────────────────┘
          ┌──────▼───────┐
          │   Question   │
          │──────────────│
          │ id (PK)      │
          │ assignment_id│
          │ type         │
          │ description  │
          │ options (JSON)│
          │ correct_answer│
          │ score        │
          │ order        │
          └──────────────┘
```

### 4.2 核心表说明

#### User 表（`user`）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (PK) | 用户ID，自增 |
| username | varchar(50) | 学号/工号，唯一标识，用于登录 |
| password | varchar(100) | bcrypt加密后的密码 |
| role | enum | 'student' / 'teacher' / 'admin' |
| name | varchar(50) | 用户真实姓名 |
| email | varchar(100) | 邮箱地址 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

#### ClassInfo 表（`class_info`）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (PK) | 班级ID |
| name | varchar(100) | 班级名称 |
| description | varchar(500) | 班级描述 |
| invite_code | varchar(20) | 8位邀请码（唯一），学生凭此加入 |
| creator_id | int (FK) | 创建者教师ID |

#### Assignment 表（`assignment`）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (PK) | 作业ID |
| title | varchar(200) | 作业标题 |
| description | text | 作业描述 |
| type | enum | subjective/objective/mixed |
| check_duplicate | boolean | 是否开启图片查重 |
| grading_criteria | text | AI批改提示词 |
| deadline | datetime | 截止时间 |
| class_id | int (FK) | 所属班级 |

#### AssignmentSubmit 表（`assignment_submit`）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (PK) | 提交记录ID |
| assignment_id | int (FK) | 作业ID |
| student_id | int (FK) | 学生ID |
| answers | json | 答案内容，格式 `{"题目ID": "答案"}` |
| score | decimal(5,2) | AI评分 |
| comment | text | AI评语 |
| status | enum | pending/grading/completed/failed |
| image_hashes | json | 图片感知哈希值 |
| ai_result | text | AI原始返回结果 |
| submitted_at | datetime | 提交时间 |
| graded_at | datetime | 批改完成时间 |

---

## 5. 模块详细设计

### 5.1 用户模块 (User Module)

**职责**：用户注册、信息查询、密码加密管理

**关键代码 - 密码加密与验证（`UserService`）**：

```typescript
// 使用 bcrypt 进行密码哈希加盐处理
// 盐值轮数设为10，平衡安全性与性能
async create(createUserDto: CreateUserDto): Promise<User> {
  // 检查用户是否已存在（工号/学号唯一性校验）
  const existUser = await this.userRepository.findOne({
    where: { username: createUserDto.username },
  });
  if (existUser) {
    throw new ConflictException('该工号/学号已经存在');
  }

  // hash 方法自动生成随机盐值并拼接进哈希结果中
  const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
  const user = new User();
  user.username = createUserDto.username;
  user.password = hashedPassword;
  user.role = createUserDto.role || UserRole.STUDENT;
  user.name = createUserDto.name || '';
  return this.userRepository.save(user);
}

// 登录时验证密码
// compare 方法从存储的哈希值中提取盐值，对输入密码重新哈希后比对
async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}
```

**设计要点**：
- bcrypt 的 hash 函数生成的密文自包含盐值（格式：$2b$10$salt+hash），无需单独存储盐值
- compare 方法内部自动从密文中提取盐值进行比对，安全性高于手动拼接
- 用户名使用唯一约束，防止重复注册

---

### 5.2 认证模块 (Auth Module)

**职责**：用户登录/注册、JWT Token 签发与验证、请求身份识别

#### 5.2.1 JWT 认证流程

```
┌──────────┐   ①登录请求    ┌──────────────┐
│  前端     │──────────────►│ AuthController│
│          │               │  /auth/login  │
│          │               └──────┬───────┘
│          │                      │
│          │               ┌──────▼───────┐
│          │               │  AuthService │
│          │               │  验证用户名   │
│          │               │  验证密码    │
│          │               │  生成JWT    │
│          │               └──────┬───────┘
│          │                      │
│          │   ②返回Token         │
│          │◄─────────────────────┘
│          │
│          │   ③携带Token请求
│          │   Authorization: Bearer <token>
│          │──────────────────────►
│          │                      │
│          │               ┌──────▼───────┐
│          │               │ JwtAuthGuard │
│          │               │  提取Token   │
│          │               │  验证签名    │
│          │               │  解析载荷    │
│          │               └──────┬───────┘
│          │                      │
│          │               ┌──────▼───────┐
│          │               │ JwtStrategy  │
│          │               │ validate()   │
│          │               │ 注入req.user │
│          │               └──────────────┘
```

**关键代码 - JWT 策略（`JwtStrategy`）**：

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly UserService: UserService) {
    super({
      // 从 Authorization: Bearer <token> 请求头中提取 JWT
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 对称加密密钥（生产环境应放在环境变量中）
      secretOrKey: 'my-super-secret-key-123456',
      // 不允许过期 Token 通过验证
      ignoreExpiration: false,
    });
  }

  // Token 验证成功后自动调用，返回值注入到 req.user
  async validate(payload: any) {
    return {
      id: payload.sub,         // 用户ID
      username: payload.username,
      role: payload.role,      // 用户角色
    };
  }
}
```

**关键代码 - 自定义装饰器（`@CurrentUser()`）**：

```typescript
// 简化Controller中获取当前用户的代码
// 替代反复写 @Req() req 然后 req.user
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;  // JwtStrategy.validate() 的返回值
  },
);

// 使用示例：async getProfile(@CurrentUser() user: any) { ... }
```

**设计要点**：
- Passport 策略模式使得认证逻辑与业务逻辑解耦，可灵活切换认证方式
- `@CurrentUser()` 装饰器将 `req.user` 提取操作封装，Controller 代码更简洁
- JWT 载荷中包含 `sub`（用户ID）、`username`、`role`，满足权限验证需求

---

### 5.3 班级模块 (Class Module)

**职责**：班级创建（教师）、加入班级（学生邀请码）、成员管理、班长设置

**关键代码 - 邀请码生成与唯一性保障**：

```typescript
// 生成8位邀请码，字符集为大写字母+数字（排除易混淆字符）
private generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 创建班级时的业务逻辑
async createClass(createClassDto: CreateClassDto, teacherId: number) {
  // 验证操作者是教师角色
  const teacher = await this.userRepository.findOne({ where: { id: teacherId } });
  if (!teacher || teacher.role !== UserRole.TEACHER) {
    throw new ForbiddenException('只有教师才能创建班级');
  }

  // 循环生成邀请码直到唯一（碰撞检测）
  let inviteCode: string;
  let codeExists = true;
  while (codeExists) {
    inviteCode = this.generateInviteCode();
    const existing = await this.classInfoRepository.findOne({
      where: { invite_code: inviteCode },
    });
    codeExists = !!existing;
  }

  // 创建班级记录
  const classInfo = this.classInfoRepository.create({
    name: createClassDto.name,
    description: createClassDto.description,
    invite_code: inviteCode,
    creator_id: teacherId,
  });
  const savedClass = await this.classInfoRepository.save(classInfo);

  // 自动将创建者添加为班级教师（班主任）
  const classTeacher = this.classTeacherRepository.create({
    class_id: savedClass.id,
    teacher_id: teacherId,
    is_main_teacher: true,
  });
  await this.classTeacherRepository.save(classTeacher);

  return savedClass;
}
```

**关键代码 - 班长设置（先清后设模式）**：

```typescript
// 确保一个班级只有一个班长
async setMonitor(classId: number, studentId: number, operatorId: number) {
  // 验证操作者是教师
  // ...

  // 先将该班所有学生的 is_monitor 设为 false
  await this.classStudentRepository.update(
    { class_id: classId },
    { is_monitor: false },
  );

  // 再将指定学生设为班长
  const membership = await this.classStudentRepository.findOne({
    where: { class_id: classId, student_id: studentId },
  });
  membership.is_monitor = true;
  return this.classStudentRepository.save(membership);
}
```

**设计要点**：
- 采用"先清后设"模式确保班级只有一个班长，避免并发问题
- ClassTeacher / ClassStudent 作为中间表，支持多对多关系（一个班级可有多个教师/学生）
- 邀请码唯一性通过 while 循环碰撞检测保证

---

### 5.4 作业模块 (Assignment Module)

**职责**：作业CRUD、学生提交、查重编排、AI批改编排（核心编排模块）

#### 5.4.1 创建作业

**关键代码**：

```typescript
async createAssignment(createDto: CreateAssignmentDto, teacherId: number): Promise<Assignment> {
  // 多层权限校验：
  // 1. 验证操作者是教师
  const teacher = await this.userRepository.findOne({ where: { id: teacherId } });
  if (!teacher || teacher.role !== UserRole.TEACHER) {
    throw new ForbiddenException('只有教师才能创建作业');
  }

  // 2. 验证教师属于该班级（防止越权在其他班级创建作业）
  const isTeacherInClass = await this.classTeacherRepository.findOne({
    where: { class_id: createDto.class_id, teacher_id: teacherId },
  });
  if (!isTeacherInClass) {
    throw new ForbiddenException('你不在这个班级中，无权创建作业');
  }

  // 3. 创建作业主体，使用 nullish coalescing 设置默认值
  const assignment = this.assignmentRepository.create({
    title: createDto.title,
    description: createDto.description,
    type: createDto.type,
    check_duplicate: createDto.check_duplicate ?? true,   // 默认开启查重
    grading_criteria: createDto.grading_criteria,
    deadline: new Date(createDto.deadline),
    class_id: createDto.class_id,
    creator_id: teacherId,
  });
  const savedAssignment = await this.assignmentRepository.save(assignment);

  // 4. 批量创建题目（使用 map 一次性生成所有实体再批量保存）
  if (createDto.questions && createDto.questions.length > 0) {
    const questions = createDto.questions.map((q, index) =>
      this.questionRepository.create({
        assignment_id: savedAssignment.id,
        type: q.type,
        description: q.description,
        options: q.options,
        correct_answer: q.correct_answer,
        score: q.score ?? 10,          // 默认10分
        order: q.order ?? index + 1,    // 默认按数组顺序
      }),
    );
    await this.questionRepository.save(questions);
  }

  return savedAssignment;
}
```

#### 5.4.2 学生提交作业（核心难点流程）

这是系统中最复杂的业务逻辑，涉及多层校验、异步查重、异步AI批改：

```typescript
async submitAssignment(submitDto: SubmitAssignmentDto, studentId: number): Promise<AssignmentSubmit> {
  // 【第1层】角色校验：只有学生可以提交
  const student = await this.userRepository.findOne({ where: { id: studentId } });
  if (!student || student.role !== UserRole.STUDENT) {
    throw new ForbiddenException('只有学生才能提交作业');
  }

  // 【第2层】存在校验：作业必须存在
  const assignment = await this.assignmentRepository.findOne({
    where: { id: submitDto.assignment_id },
    relations: ['class_info'],
  });
  if (!assignment) throw new NotFoundException('作业不存在');

  // 【第3层】时效校验：截止时间之后不能提交
  if (new Date(assignment.deadline) < new Date()) {
    throw new BadRequestException('作业已截止，无法提交');
  }

  // 【第4层】归属校验：学生必须在该班级中
  const isInClass = await this.classStudentRepository.findOne({
    where: { class_id: assignment.class_id, student_id: studentId },
  });
  if (!isInClass) throw new ForbiddenException('你不在这个班级中，无法提交作业');

  // 【第5层】重复校验：防止重复提交
  const existingSubmit = await this.submitRepository.findOne({
    where: { assignment_id: submitDto.assignment_id, student_id: studentId },
  });
  if (existingSubmit) throw new BadRequestException('你已经提交过这个作业了');

  // 【第6层】保存提交记录，初始状态为 pending
  const submit = this.submitRepository.create({
    assignment_id: submitDto.assignment_id,
    student_id: studentId,
    answers: submitDto.answers,
    status: SubmitStatus.PENDING,
  });
  const savedSubmit = await this.submitRepository.save(submit);

  // 【第7层】查重检测（如果作业开启了查重）
  if (assignment.check_duplicate) {
    try {
      // 计算图片感知哈希
      const imageHashes = await this.duplicateCheckService.calculateImageHashes(
        submitDto.answers as Record<string, any>,
      );
      await this.submitRepository.update(savedSubmit.id, { image_hashes: imageHashes });

      // 与已有提交比对
      const duplicateResult = await this.duplicateCheckService.checkDuplicate(
        submitDto.assignment_id, studentId, submitDto.answers as Record<string, any>,
      );
      await this.submitRepository.update(savedSubmit.id, {
        duplicate_check_result: duplicateResult,
      });

      // 如果发现抄袭，标记失败并终止批改流程
      if (duplicateResult.isDuplicate) {
        await this.submitRepository.update(savedSubmit.id, {
          status: SubmitStatus.FAILED,
          comment: '作业图片与他人重复，疑似抄袭',
        });
        return savedSubmit;
      }
    } catch (error) {
      console.error('查重失败:', error);
      // 查重失败不影响继续批改（降级策略）
    }
  }

  // 【第8层】异步调用AI批改（fire-and-forget 模式）
  // 不等待批改完成，立即返回提交成功
  this.processGrading(savedSubmit.id, assignment);

  return savedSubmit;
}
```

**设计要点**：
- 采用 **5层防护式校验**（角色→存在→时效→归属→重复），逐层过滤非法请求
- 查重失败采用 **降级策略（Graceful Degradation）**，不影响批改主流程
- AI批改采用 **Fire-and-Forget 异步模式**，提交后立即返回，不阻塞用户等待
- `processGrading` 方法中先更新状态为 `grading`，让前端可轮询获取批改进度

#### 5.4.3 学生作业列表的状态聚合

```typescript
async getStudentAssignments(studentId: number): Promise<any[]> {
  // 1. 获取学生所在的所有班级
  const studentClasses = await this.classStudentRepository.find({
    where: { student_id: studentId },
  });
  if (studentClasses.length === 0) return [];

  const classIds = studentClasses.map((sc) => sc.class_id);

  // 2. 使用 TypeORM 的 In 操作符批量查询多个班级的作业
  const assignments = await this.assignmentRepository.find({
    where: { class_id: In(classIds) },
    relations: ['class_info', 'creator'],
    order: { deadline: 'ASC' },
  });

  // 3. 批量查询该学生对所有作业的提交情况
  const studentSubmits = await this.submitRepository.find({
    where: {
      student_id: studentId,
      assignment_id: In(assignments.map((a) => a.id)),
    },
  });

  // 4. 使用 QueryBuilder 批量统计提交人数（GROUP BY 聚合）
  const submitCounts = await this.submitRepository
    .createQueryBuilder('submit')
    .select('submit.assignment_id', 'assignment_id')
    .addSelect('COUNT(*)', 'count')
    .where('submit.assignment_id IN (:...ids)', { ids: assignments.map((a) => a.id) })
    .groupBy('submit.assignment_id')
    .getRawMany();

  // 5. 使用 Map 将查询结果以 O(1) 复杂度关联
  const submitCountMap = new Map(submitCounts.map((s) => [s.assignment_id, parseInt(s.count)]));
  const submitMap = new Map(studentSubmits.map((s) => [s.assignment_id, s]));

  // 6. 组装返回数据，计算 is_overdue
  const now = new Date();
  return assignments.map((a) => {
    const submit = submitMap.get(a.id);
    return {
      id: a.id,
      title: a.title,
      // ...
      is_overdue: new Date(a.deadline) < now,      // 是否过期
      submit_status: submit?.status || null,         // 提交状态 (null=未提交)
      submit_count: submitCountMap.get(a.id) || 0,   // 总提交人数
      score: submit?.score || null,                  // 得分
    };
  });
}
```

**设计要点**：
- 使用 `In` 操作符减少数据库查询次数（批量 where in）
- 使用 `Map` 数据结构实现 O(1) 复杂度的关联查询，避免嵌套循环 O(n²)
- `is_overdue` 在服务端计算而非数据库存储，确保时区一致性

#### 5.4.4 图片路径处理（URL转换）

```typescript
// 数据库存储相对路径 /uploads/img-xxx.png
// 返回给前端时需要拼接完整URL，支持内网穿透场景
private processAnswersWithImages(answers: object): object {
  const baseUrl = this.getBaseUrl();
  const processed: Record<string, any> = {};

  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === 'string') {
      // 处理多图片（换行分隔）场景
      if (value.includes('\n') && this.containsImagePath(value)) {
        const paths = value.split('\n').filter((p) => p.trim());
        processed[key] = paths.map((path) => {
          const trimmed = path.trim();
          return trimmed.startsWith('/uploads/') ? `${baseUrl}${trimmed}` : trimmed;
        });
      } else if (value.startsWith('/uploads/')) {
        processed[key] = `${baseUrl}${value}`;
      } else {
        processed[key] = value;
      }
    }
    // ...处理数组类型
  }
  return processed;
}

// 优先使用环境变量中的公网地址（内网穿透时AI需要公网URL访问图片）
private getBaseUrl(): string {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  if (publicBaseUrl) return publicBaseUrl;

  // 从当前请求中动态拼接
  const protocol = this.request.protocol || 'http';
  const hostname = this.request.hostname || 'localhost';
  // 智能处理端口显示（80/443默认端口不显示）
  const showPort = ![80, 443, '80', '443'].includes(this.request.port);
  const portStr = showPort ? `:${this.request.port}` : '';
  return `${protocol}://${hostname}${portStr}`;
}
```

**设计要点**：
- 数据库存储相对路径，前端访问时拼接 Base URL，实现部署环境无关
- 通过 `PUBLIC_BASE_URL` 环境变量支持内网穿透场景（如 ngrok 隧道）
- 智能处理80/443默认端口，生成的URL更加干净美观

---

### 5.5 AI批改模块 (Grading Module)

**职责**：调用阿里云通义千问多模态模型进行作业批改

#### 5.5.1 批改流程

```
学生提交作业
    │
    ▼
┌─────────────────────┐
│ 构建 AI Prompt      │
│ - System: 批改标准  │
│ - User: 作业+答案    │
│ - Images: 图片附件  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 调用千问 API        │
│ POST /chat/         │
│ completions         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 解析 JSON 响应      │
│ {score, comment,    │
│  details}           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 更新数据库          │
│ status=completed    │
│ score, comment      │
└─────────────────────┘
```

**关键代码 - 构建多模态 Prompt**：

```typescript
private buildMessages(request: GradingRequest) {
  const { title, description, type, grading_criteria, questions, answers } = request;

  // System Prompt：定义AI的角色、评判标准和输出格式
  let systemPrompt = `你是一位网络工程专业的作业批改老师...
评判标准：${grading_criteria || '按照标准答案进行评判'}
作业类型：${type === 'subjective' ? '主观题' : type === 'objective' ? '客观题' : '混合题型'}
请返回JSON格式的批改结果：{ "score": 总分, "comment": "评语", "details": {...} }`;

  // User Content：构建多模态消息数组
  const contentParts: any[] = [];
  const answersObj = answers as Record<string, any>;

  // 遍历每道题的答案，文字题用 text 类型，图片题用 image_url 类型
  Object.keys(answersObj).forEach((questionId) => {
    const answer = answersObj[questionId];
    if (Array.isArray(answer)) {
      for (const item of answer) {
        if (this.isImageUrl(item)) {
          contentParts.push({ type: 'image_url', image_url: { url: item } });
        } else {
          contentParts.push({ type: 'text', text: String(item) });
        }
      }
    } else if (this.isImageUrl(answer)) {
      contentParts.push({ type: 'image_url', image_url: { url: answer } });
    } else {
      contentParts.push({ type: 'text', text: String(answer) });
    }
  });

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contentParts },
  ];
}
```

**关键代码 - HTTPS API 调用**：

```typescript
// 使用 Node.js 原生 https 模块（无需额外依赖）
private async callAliyunAPI(messages: any[]): Promise<any> {
  const url = `${this.baseUrl}/chat/completions`;
  const body = JSON.stringify({
    model: this.model,           // qwen-vl-plus（支持视觉识别）
    messages: messages,
    stream: false,
  });

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', (e) => reject(new Error(`API调用失败: ${e.message}`)));
    req.write(body);
    req.end();
  });
}
```

**设计要点**：
- 使用原生 `https` 模块而非 axios，减少依赖体积
- `qwen-vl-plus` 模型支持图文混合输入，学生可上传图片作答
- System Prompt 通过 `grading_criteria` 让教师自定义批改标准
- JSON 返回格式通过正则提取（兼容AI返回不纯JSON的情况）

---

### 5.6 文件上传模块 (Upload Module)

**职责**：文件上传存储、UUID命名、图片查重

#### 5.6.1 文件上传管理

```typescript
@Injectable()
export class UploadService {
  // 使用 UUID 生成唯一文件名，避免文件名冲突
  generateUniqueFilename(originalname: string): string {
    const ext = originalname.split('.').pop();
    return `${uuidv4()}.${ext}`;  // 如：a1b2c3d4-e5f6.png
  }

  getFileUrl(filename: string): string {
    return `/uploads/${filename}`;
  }
}
```

#### 5.6.2 图片查重 - 感知哈希算法

这是系统的**核心技术难点**之一。使用感知哈希（Perceptual Hash）而非密码学哈希，因为感知哈希对图片的微小变化（缩放、压缩、亮度调整）具有鲁棒性。

```typescript
/**
 * 查重原理：
 * 1. 感知哈希（pHash）：基于图像频率域特征，相似图片哈希值接近
 * 2. 汉明距离（Hamming Distance）：比较两个哈希的不同位数
 * 3. 阈值判定：距离 ≤ 10 视为抄袭
 *
 * 对比密码学哈希（SHA256）：
 * - SHA256：一个像素不同 → 完全不同的哈希
 * - pHash：一个像素不同 → 几乎相同的哈希（实际场景适用）
 */
@Injectable()
export class DuplicateCheckService {
  // 汉明距离计算
  calculateSimilarity(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      throw new Error('哈希长度不一致，无法比较');
    }
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) distance++;
    }
    return distance;
  }

  // 相似度百分比（用于前端展示）
  getSimilarityPercent(hash1: string, hash2: string): number {
    const distance = this.calculateSimilarity(hash1, hash2);
    const similarity = ((64 - distance) / 64) * 100;
    return Math.round(similarity * 100) / 100;
  }

  // 查重主逻辑：与所有其他已提交学生的图片逐一比对
  async checkDuplicate(
    assignmentId: number,
    studentId: number,
    answers: Record<string, any>,
  ): Promise<{ isDuplicate: boolean; duplicates: any[] }> {
    const duplicates: any[] = [];
    const submittedImages = this.extractImagesFromAnswers(answers);
    if (submittedImages.length === 0) {
      return { isDuplicate: false, duplicates: [] };
    }

    // 获取同作业的其他学生提交
    const otherSubmits = await this.submitRepository.find({
      where: { assignment_id: assignmentId },
    });
    const otherStudentSubmits = otherSubmits.filter(s => s.student_id !== studentId);

    // 计算当前提交的图片哈希
    const submittedHashes = new Map<string, { hash: string; questionId: string }>();
    for (const { questionId, imagePath } of submittedImages) {
      const hash = await this.getImageHash(imagePath);
      submittedHashes.set(imagePath, { hash, questionId });
    }

    // 逐一与历史提交比对
    for (const submit of otherStudentSubmits) {
      const otherImages = this.extractImagesFromAnswers(submit.answers as Record<string, any>);
      for (const [submittedPath, { hash: submittedHash, questionId }] of submittedHashes) {
        for (const { questionId: otherQuestionId, imagePath: otherPath } of otherImages) {
          const otherHash = await this.getImageHash(otherPath);
          const hammingDistance = this.calculateSimilarity(submittedHash, otherHash);
          // 汉明距离 ≤ 10 判定为抄袭
          if (hammingDistance <= 10) {
            duplicates.push({
              questionId,
              submittedImage: submittedPath,
              similarImage: otherPath,
              similarity: this.getSimilarityPercent(submittedHash, otherHash),
              hammingDistance,
              similarSubmitId: submit.id,
              similarStudentId: submit.student_id,
            });
          }
        }
      }
    }

    return { isDuplicate: duplicates.length > 0, duplicates };
  }
}
```

**设计要点**：
- 感知哈希 vs 密码学哈希的选择考量：作业查重需要容忍合法的图片差异（缩放、压缩等）
- 汉明距离阈值10是通过经验值设定，可通过配置调整
- 图片提取支持嵌套数组结构，兼容前端不同提交格式

---

### 5.7 成绩管理模块 (Score Module)

**职责**：成绩统计、排名计算、数据聚合

#### 5.7.1 老师端 - 作业成绩列表（卡片）

```typescript
async getTeacherAssignmentGrades(teacherId: number): Promise<AssignmentGradeSummary[]> {
  // 验证教师身份
  const teacher = await this.userRepository.findOne({ where: { id: teacherId } });
  if (!teacher || teacher.role !== UserRole.TEACHER) {
    throw new ForbiddenException('只有教师才能查看作业成绩');
  }

  // 获取该教师创建的所有作业（按创建时间倒序）
  const assignments = await this.assignmentRepository.find({
    where: { creator_id: teacherId },
    relations: ['class_info'],
    order: { created_at: 'DESC' },
  });

  // Promise.all 并行处理每个作业的统计（性能优化）
  const gradeSummaries = await Promise.all(
    assignments.map(async (assignment) => {
      const classStudentCount = await this.classStudentRepository.count({
        where: { class_id: assignment.class_id },
      });
      const submittedCount = await this.submitRepository.count({
        where: { assignment_id: assignment.id },
      });

      // 使用 SQL AVG 聚合函数计算平均分（仅统计已批改完成的）
      const avgScoreResult = await this.submitRepository
        .createQueryBuilder('submit')
        .select('AVG(submit.score)', 'avg_score')
        .where('submit.assignment_id = :assignmentId', { assignmentId: assignment.id })
        .andWhere('submit.status = :status', { status: SubmitStatus.COMPLETED })
        .getRawOne();

      return {
        id: assignment.id,
        title: assignment.title,
        class_name: assignment.class_info?.name,
        submitted_count: submittedCount,
        not_submitted_count: classStudentCount - submittedCount,
        class_total_count: classStudentCount,
        class_average_score: avgScoreResult?.avg_score
          ? parseFloat(parseFloat(avgScoreResult.avg_score).toFixed(2))
          : null,
        created_at: assignment.created_at,
        deadline: assignment.deadline,
      };
    }),
  );
  return gradeSummaries;
}
```

#### 5.7.2 排名计算（并列排名算法）

```typescript
// 排名计算核心逻辑 - 支持并列排名
// 例如：3人分数为 100, 100, 90 → 排名 1, 1, 3
const scoredSubmits = gradedSubmits
  .map((s) => ({
    student_id: s.student_id,
    student_name: s.student?.name || '未知',
    student_username: s.student?.username || '未知',
    score: s.score,
    comment: s.comment,
    status: s.status,
    submitted_at: s.submitted_at,
    graded_at: s.graded_at,
  }))
  .sort((a, b) => (b.score as number) - (a.score as number)); // 降序排列

// 使用"跳跃式"排名计算
let currentRank = 1;
let previousScore: number | null = null;

const studentsWithRank = scoredSubmits.map((s, index) => {
  // 如果当前分数与前一个不同，跳到当前位置 + 1
  if (previousScore !== null && s.score !== previousScore) {
    currentRank = index + 1;
  }
  previousScore = s.score;
  return { ...s, rank: currentRank };
});
```

**设计要点**：
- 使用 `Promise.all` 并行查询提升性能
- SQL `AVG()` 聚合函数在数据库层计算平均分，避免传输大量数据到应用层
- 并列排名算法采用"跳跃式"而非"稠密式"，符合学校排名惯例

---

### 5.8 公共模块 (Common Module)

#### 5.8.1 全局响应拦截器

```typescript
/**
 * 统一响应包装拦截器
 * 将所有 Controller 返回的数据自动包装为统一格式
 *
 * 原始返回: { id: 1, name: "张三" }
 * 包装后:   { code: 200, message: "success", data: { id: 1, name: "张三" }, timeStamp: "...", path: "/..." }
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ResponseDto<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseDto<T>> {
    const request = context.switchToHttp().getRequest();

    // next.handle() 执行后续流程（Controller）
    // pipe(map()) 对返回值进行转换
    return next.handle().pipe(
      map((data) => ({
        code: 200,
        message: 'success',
        data,
        timeStamp: new Date().toISOString(),
        path: request.url,
      })),
    );
  }
}
```

**设计要点**：
- 使用 RxJS `map` 操作符对响应数据进行转换
- 自动注入 `timeStamp`（时间戳）和 `path`（请求路径），便于调试追踪
- 所有正常响应统一 code=200，异常由异常过滤器处理

#### 5.8.2 全局异常过滤器

```typescript
@Catch()  // 不指定异常类型 = 捕获所有异常
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 默认值（未预料的异常）
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let code = 500;

    if (exception instanceof HttpException) {
      // NestJS 标准异常（ForbiddenException, NotFoundException 等）
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        code = (exceptionResponse as any).code || status;
      }
    } else if (exception instanceof Error) {
      // 普通 JavaScript Error
      message = exception.message;
    }

    // 结构化错误日志
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    // 统一错误响应格式
    response.status(status).json({
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

**设计要点**：
- `@Catch()` 无参数表示捕获所有异常类型，确保无漏网之鱼
- 兼容 HttpException（业务异常）和普通 Error（系统异常）两种类型
- 统一错误响应格式，前端只需按一种格式处理错误

#### 5.8.3 日志中间件（敏感数据脱敏 + 链路追踪）

```typescript
// 敏感字段列表
const SENSITIVE_FIELDS = [
  'password', 'token', 'access_token',
  'refresh_token', 'secret', 'authorization',
];

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: any, res: any, next: NextFunction) {
    // 1. 生成链路追踪ID（traceId）
    const traceId = uuidv4();
    (req as any).traceId = traceId;

    const { method, originalUrl: url, ip, headers } = req;
    const realIp = headers['x-forwarded-for'] || ip || '0.0.0.0';

    // 2. 对请求体进行敏感字段脱敏
    const requestBody = this.maskSensitive(req.body);
    const startTime = Date.now();

    // 3. 监听响应结束事件，记录完整日志
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      const logData = {
        traceId,          // 链路ID
        timeStamp: new Date().toISOString(),
        method,           // GET/POST/DELETE
        url,              // 请求路径
        ip: realIp,       // 客户端IP
        userAgent,        // 浏览器信息
        statusCode,       // HTTP状态码
        durationMs: duration, // 请求耗时(ms)
        request: requestBody, // 请求体（已脱敏）
      };

      // 4. 按状态码分级记录
      if (statusCode >= 500) {
        logger.error('服务器异常or请求异常', logData);
      } else if (statusCode >= 400) {
        logger.warn('请求失败', logData);
      } else {
        logger.info('请求完成', logData);
      }
    });

    next();  // 放行到下一个中间件/控制器
  }

  // 脱敏方法：将敏感字段替换为 ***masked***
  private maskSensitive(body: any) {
    if (!body || typeof body !== 'object') return body;
    const masked = { ...body };
    for (const key of SENSITIVE_FIELDS) {
      if (masked[key]) masked[key] = '***masked***';
    }
    return masked;
  }
}
```

**设计要点**：
- `traceId`（UUID）贯穿整个请求生命周期，方便在分布式日志中追踪
- `res.on('finish')` 事件监听确保在响应发送完后再记录（获取真实状态码和耗时）
- 敏感字段脱敏：密码、Token 等在日志显示为 `***masked***`，防止日志泄露
- 按 HTTP 状态码分级：info（2xx）/ warn（4xx）/ error（5xx）

---

## 6. API接口文档

### 6.1 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {},
  "timeStamp": "2026-05-04T12:00:00.000Z",
  "path": "/api/xxx"
}
```

### 6.2 认证接口 (`/auth`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/auth/register` | 否 | 用户注册 |
| POST | `/auth/login` | 否 | 用户登录（返回JWT） |

### 6.3 用户接口 (`/user`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/user/profile` | JWT | 获取当前用户信息 |

### 6.4 班级接口 (`/class`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/class/create` | JWT(教师) | 创建班级 |
| POST | `/class/join` | JWT(学生) | 通过邀请码加入班级 |
| GET | `/class/teacher/list` | JWT(教师) | 教师班级列表 |
| GET | `/class/student/list` | JWT(学生) | 学生班级列表 |
| GET | `/class/:id` | JWT | 班级详情 |
| GET | `/class/:id/students` | JWT | 班级学生列表 |
| GET | `/class/:id/teachers` | JWT | 班级教师列表 |
| DELETE | `/class/:id/student/:studentId` | JWT(教师) | 移除学生 |
| PUT | `/class/:id/monitor/:studentId` | JWT(教师) | 设置班长 |

### 6.5 作业接口 (`/assignment`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/assignment/create` | JWT(教师) | 创建作业 |
| GET | `/assignment/teacher/list` | JWT(教师) | 教师作业列表 |
| GET | `/assignment/student/list` | JWT(学生) | 学生作业列表（含提交状态） |
| GET | `/assignment/:id` | JWT(学生) | 作业详情（含我的提交） |
| GET | `/assignment/:id/detail` | JWT | 作业详情（不含提交信息） |
| POST | `/assignment/submit` | JWT(学生) | 提交作业 |
| DELETE | `/assignment/:id` | JWT(教师) | 删除作业 |
| GET | `/assignment/:id/submits` | JWT(教师) | 作业提交列表 |

### 6.6 成绩接口 (`/score`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/score/teacher/assignments` | JWT(教师) | 教师作业成绩卡片列表 |
| GET | `/score/assignment/:id` | JWT(教师) | 作业学生成绩详情（排名） |
| GET | `/score/student/assignments` | JWT(学生) | 学生我的成绩列表 |

### 6.7 文件上传接口 (`/upload`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/upload/image` | JWT | 上传图片 |
| GET | `/upload/:filename` | 否 | 静态文件访问 |

---

## 7. 关键技术与难点解析

### 7.1 多层防护式权限校验

系统在关键操作（提交作业、删除作业等）中采用**链式校验**模式，每一层是一个独立的安全检查：

```
角色校验 → 存在校验 → 时效校验 → 归属校验 → 重复校验 → 业务逻辑
```

**设计理念**：
- 每个校验层独立，可单独测试和修改
- 失败即抛出异常，后续代码不再执行（Fail-Fast原则）
- 校验顺序从"通用"到"特定"，减少不必要的数据库查询

### 7.2 异步批改与状态机

AI批改耗时较长（通常5-30秒），系统采用**状态机+异步处理**模式：

```
PENDING(待批改) → GRADING(批改中) → COMPLETED(已完成)
                                   → FAILED(批改失败)
```

前端通过轮询 `submit_status` 字段感知批改进度，无需WebSocket等复杂机制。

### 7.3 感知哈希查重 vs 传统查重

| 维度 | 传统MD5/SHA | 感知哈希(pHash) |
|------|------------|----------------|
| 微小修改 | 完全不同 | 几乎相同 |
| 缩放裁剪 | 完全不同 | 相似度下降 |
| 格式转换 | 完全不同 | 几乎相同 |
| **适用场景** | 精确去重 | **图片查重（鲁棒性）** |

### 7.4 Map优化批量关联查询

在 `getStudentAssignments` 等方法中，采用两步策略避免 N+1 查询：

```
步骤1: 批量查询所有数据（1次SQL）
步骤2: 使用Map在内存中进行O(1)关联
```

而不是：

```
for each assignment:
  查询 submit_count（N次SQL）  ← N+1问题
```

### 7.5 环境感知BaseURL

图片URL的拼接不是一个简单的字符串操作，而是一个**三段式决策链条**：

```
1. 检查 PUBLIC_BASE_URL 环境变量（内网穿透优先）
2. 检查 request 对象是否存在（定时任务等场景无request）
3. 从 request 中动态提取 protocol + host + port
4. 智能处理80/443默认端口（不显示，URL更美观）
```

---

## 8. 安全性设计

### 8.1 密码安全

- **bcrypt 加盐哈希**：每用户独立随机盐值，盐值内嵌于密文中
- **加盐轮数10**：平衡安全性与登录性能（约100ms/次）
- **绝不存储明文密码**：从注册到验证全程使用哈希

### 8.2 认证安全

- **JWT Token**：无状态认证，服务端无需存储Session
- **Token 载荷最小化**：仅包含 id、username、role，不含敏感信息
- **守卫全局化**：`@UseGuards(JwtAuthGuard)` 装饰在 Controller 级别

### 8.3 授权安全

- **角色粒度控制**：每个接口通过 `user.role` 判断操作者身份
- **数据归属校验**：教师只能操作自己创建的作业/班级
- **班级成员校验**：学生只能提交自己班级的作业

### 8.4 数据安全

- **输入验证**：`class-validator` DTO 验证 + `whitelist: true` 过滤非白名单字段
- **敏感数据脱敏**：日志中间件自动替换 password、token 等为 `***masked***`
- **CORS 配置**：生产环境需替换 `origin: '*'` 为具体域名

---

## 9. 部署与运行

### 9.1 环境要求

| 依赖 | 版本 |
|------|------|
| Node.js | ≥ 18.x |
| MySQL | ≥ 8.0 |
| pnpm/npm | 最新版 |

### 9.2 环境变量配置 (`.env`)

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=ai_check_assignment

# 阿里云千问API（通义千问）
ALIYUN_API_KEY=sk-your-api-key
ALIYUN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
ALIYUN_MODEL=qwen-vl-plus

# 公网地址（内网穿透时需要，如 ngrok）
# AI需要公网URL才能访问上传的图片
PUBLIC_BASE_URL=https://your-domain.com
```

### 9.3 安装与启动

```bash
# 1. 安装依赖
pnpm install

# 2. 创建数据库
# 在 MySQL 中创建 ai_check_assignment 数据库

# 3. 启动开发服务器（热重载）
pnpm run start:dev

# 4. 生产构建与部署
pnpm run build
pnpm run start:prod
```

### 9.4 项目启动流程

`main.ts` 启动时的全局配置注册顺序：

```
1. NestFactory.create(AppModule)      - 创建应用实例
2. ValidationPipe (whitelist+transform) - 全局参数验证管道
3. ResponseInterceptor                 - 全局响应格式统一
4. HttpExceptionFilter                 - 全局异常处理
5. enableCors                          - 跨域资源共享
6. app.listen(3000, '0.0.0.0')        - 监听所有网卡
```

---

## 附录

### A. 提交状态码说明

| 状态 | 枚举值 | 含义 | 前端展示建议 |
|------|--------|------|------------|
| 未提交 | `null` | 学生尚未提交作业 | "去提交" / "已截止" |
| 待批改 | `pending` | 已提交，等待AI批改 | "等待批改中" |
| 批改中 | `grading` | AI正在批改 | "批改中..." |
| 已完成 | `completed` | 批改完成，有分数 | 显示分数 + 评语 |
| 失败 | `failed` | 批改异常或查重不通过 | "批改失败" / "疑似抄袭" |

### B. 作业类型说明

| 类型 | 枚举值 | 说明 |
|------|--------|------|
| 主观题 | `subjective` | 简答/论述，需要AI理解批改 |
| 客观题 | `objective` | 选择/判断，有标准答案 |
| 混合 | `mixed` | 同时包含主观题和客观题 |

---

> **开发笔记**：本项目采用 NestJS 框架的模块化 + 依赖注入设计模式，通过 Controller-Service-Repository 三层架构实现了业务逻辑的清晰分离。AI批改模块通过阿里云千问多模态API实现了文字+图片混合批改能力，图片查重模块使用感知哈希算法在保证鲁棒性的同时有效检测抄袭行为。
