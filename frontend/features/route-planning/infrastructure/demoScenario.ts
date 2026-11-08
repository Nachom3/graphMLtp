import type { Scenario } from "../domain/types";

/** Escenario pequeño para que la demo siga disponible sin API local. */
export const demoScenario: Scenario = {
  scenarioId: "piloto-mvd",
  version: "v1",
  nodes: [
    { nodeId: "N0001", lon: -56.16, lat: -34.915 },
    { nodeId: "N0002", lon: -56.155, lat: -34.91 },
    { nodeId: "N0003", lon: -56.15, lat: -34.905 },
  ],
  segments: [
    {
      segmentId: "T0001",
      originNode: "N0001",
      destinationNode: "N0002",
      lengthM: 85.5,
      zoneType: "residential",
      containerCount: 1,
      daysSinceLastCollection: 2,
      historicNeighborComplaints: 0,
    },
    {
      segmentId: "T0002",
      originNode: "N0002",
      destinationNode: "N0003",
      lengthM: 120,
      zoneType: "commercial",
      containerCount: 2,
      daysSinceLastCollection: 4,
      historicNeighborComplaints: 2,
    },
    {
      segmentId: "T0003",
      originNode: "N0001",
      destinationNode: "N0003",
      lengthM: 96.3,
      zoneType: "industrial",
      containerCount: 1,
      daysSinceLastCollection: 3,
      historicNeighborComplaints: 1,
    },
  ],
};
