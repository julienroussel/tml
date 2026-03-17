import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncStatus } from "./sync-status";

const mockStatus = {
  connected: false,
  dataFlowStatus: {
    uploading: false,
    downloading: false,
    downloadError: undefined as Error | undefined,
    uploadError: undefined as Error | undefined,
  },
};

vi.mock("@powersync/react", () => ({
  useStatus: () => mockStatus,
}));

function resetStatus(): void {
  mockStatus.connected = false;
  mockStatus.dataFlowStatus.uploading = false;
  mockStatus.dataFlowStatus.downloading = false;
  mockStatus.dataFlowStatus.downloadError = undefined;
  mockStatus.dataFlowStatus.uploadError = undefined;
}

describe("SyncStatus", () => {
  beforeEach(() => {
    resetStatus();
  });

  it("renders offline status when disconnected", () => {
    render(<SyncStatus />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("sync.offline")).toBeInTheDocument();
  });

  it("renders online status when connected with no activity", () => {
    mockStatus.connected = true;
    render(<SyncStatus />);

    expect(screen.getByText("sync.online")).toBeInTheDocument();
  });

  it("renders syncing status when connected and downloading", () => {
    mockStatus.connected = true;
    mockStatus.dataFlowStatus.downloading = true;
    render(<SyncStatus />);

    expect(screen.getByText("sync.syncing")).toBeInTheDocument();
  });

  it("renders pendingChanges status when connected and uploading", () => {
    mockStatus.connected = true;
    mockStatus.dataFlowStatus.uploading = true;
    render(<SyncStatus />);

    expect(screen.getByText("sync.pendingChanges")).toBeInTheDocument();
  });

  it("renders error status when there is a download error", () => {
    mockStatus.connected = true;
    mockStatus.dataFlowStatus.downloadError = new Error("download failed");
    render(<SyncStatus />);

    expect(screen.getByText("sync.error")).toBeInTheDocument();
  });

  it("renders error status when there is an upload error", () => {
    mockStatus.dataFlowStatus.uploadError = new Error("upload failed");
    render(<SyncStatus />);

    expect(screen.getByText("sync.error")).toBeInTheDocument();
  });

  it("prioritizes error over syncing status", () => {
    mockStatus.connected = true;
    mockStatus.dataFlowStatus.downloading = true;
    mockStatus.dataFlowStatus.downloadError = new Error("fail");
    render(<SyncStatus />);

    expect(screen.getByText("sync.error")).toBeInTheDocument();
  });
});
