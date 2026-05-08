import { describe, expect, it } from "vitest";
import { createDemoProjects } from "./demoData";
import { toInterval } from "../utils/intervals";

describe("createDemoProjects", () => {
  it("includes overlapping stages for overlay demos", () => {
    const now = new Date(2026, 4, 7, 12, 0, 0, 0);
    const [project] = createDemoProjects(now);

    expect(project).toBeDefined();
    expect(project.stages.length).toBeGreaterThanOrEqual(4);

    const careerExploration = project.stages.find((stage) => stage.name === "职业探索");
    const sideProject = project.stages.find((stage) => stage.name === "自由项目孵化");

    expect(careerExploration).toBeDefined();
    expect(sideProject).toBeDefined();

    const careerInterval = toInterval(
      careerExploration!.startDate,
      careerExploration!.endDate
    );
    const sideProjectInterval = toInterval(sideProject!.startDate, sideProject!.endDate);

    expect(careerInterval).not.toBeNull();
    expect(sideProjectInterval).not.toBeNull();
    expect(careerInterval!.startMs).toBeLessThan(sideProjectInterval!.endMs);
    expect(sideProjectInterval!.startMs).toBeLessThan(careerInterval!.endMs);
  });
});
