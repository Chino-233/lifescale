import type { LifeProject } from "../types/life";
import { createId, timestamp } from "../utils/id";

function yearDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function createDemoProjects(now: Date = new Date()): LifeProject[] {
  const currentYear = now.getFullYear();
  const createdAt = timestamp();

  return [
    {
      id: createId(),
      name: "我的二十多岁",
      description: "记录二十多岁里几个重要阶段、暂停期与里程碑。",
      createdAt,
      updatedAt: createdAt,
      stages: [
        {
          id: createId(),
          name: "大学阶段",
          startDate: yearDate(currentYear - 5, 9, 1),
          endDate: yearDate(currentYear - 1, 6, 30),
          color: "#2563eb",
          description: "一段慢慢建立方向感的时期。",
          tags: ["学习", "成长"],
          excludedPeriods: [],
          milestones: [
            {
              id: createId(),
              name: "开始大学",
              date: yearDate(currentYear - 5, 9, 1),
              description: "进入新的城市与新的节奏。",
              createdAt,
              updatedAt: createdAt,
            },
            {
              id: createId(),
              name: "毕业",
              date: yearDate(currentYear - 1, 6, 30),
              createdAt,
              updatedAt: createdAt,
            },
          ],
          createdAt,
          updatedAt: createdAt,
        },
        {
          id: createId(),
          name: "职业探索",
          startDate: yearDate(currentYear, 1, 1),
          endDate: yearDate(currentYear, 12, 31),
          color: "#059669",
          description: "观察什么工作方式真正适合自己。",
          tags: ["工作", "探索"],
          excludedPeriods: [
            {
              id: createId(),
              name: "恢复与调整",
              startDate: yearDate(currentYear, 3, 1),
              endDate: yearDate(currentYear, 3, 21),
              reason: "主动放慢节奏，重新整理状态。",
              countAsExcluded: true,
              createdAt,
              updatedAt: createdAt,
            },
          ],
          milestones: [
            {
              id: createId(),
              name: "确认新的方向",
              date: yearDate(currentYear, 5, 6),
              description: "把模糊的想法写成可以行动的计划。",
              createdAt,
              updatedAt: createdAt,
            },
          ],
          createdAt,
          updatedAt: createdAt,
        },
        {
          id: createId(),
          name: "创业准备",
          startDate: yearDate(currentYear + 1, 1, 1),
          endDate: yearDate(currentYear + 2, 12, 31),
          color: "#7c3aed",
          description: "为长期项目留出持续试验的空间。",
          tags: ["创造", "项目"],
          excludedPeriods: [],
          milestones: [
            {
              id: createId(),
              name: "第一个 MVP",
              date: yearDate(currentYear + 1, 6, 1),
              createdAt,
              updatedAt: createdAt,
            },
          ],
          createdAt,
          updatedAt: createdAt,
        },
      ],
    },
  ];
}
