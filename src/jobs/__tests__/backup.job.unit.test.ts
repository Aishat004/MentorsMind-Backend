const mockCronCallbacks: Array<() => Promise<void>> = [];

jest.mock("../../config/env", () => ({
  env: { ADMIN_ALERT_EMAIL: undefined },
}));

jest.mock("../../services/backup.service", () => ({
  BackupService: {
    runFullBackup: jest.fn(),
    verifyBackup: jest.fn(),
    runWALBackup: jest.fn(),
    applyRetentionPolicy: jest.fn(),
  },
}));

jest.mock("../../services/email.service", () => ({
  emailService: { sendEmail: jest.fn() },
}));

jest.mock("../../utils/error.utils", () => ({
  logInfo: jest.fn(),
  logWarning: jest.fn(),
  logError: jest.fn(),
}));

jest.mock("cron", () => ({
  CronJob: jest.fn().mockImplementation((_schedule, callback) => {
    mockCronCallbacks.push(callback);
    return { start: jest.fn(), stop: jest.fn() };
  }),
}));

import { BackupService } from "../../services/backup.service";
import { emailService } from "../../services/email.service";
import backupJob from "../backup.job";

describe("backup job alerts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCronCallbacks.length = 0;
  });

  it("does not send an alert when the invalid admin email was omitted", async () => {
    (BackupService.runFullBackup as jest.Mock).mockResolvedValue({
      status: "failed",
      id: "backup-1",
      error: "disk full",
    });

    backupJob.initialize();
    await mockCronCallbacks[0]();

    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });
});