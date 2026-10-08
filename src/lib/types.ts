import type {
  alerts,
  appointments,
  assistanceCases,
  crisisEvents,
  missions,
  tripDestinations,
  trips,
  users,
} from "@/db/schema";

export type User = typeof users.$inferSelect;
export type Mission = typeof missions.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type Destination = typeof tripDestinations.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type CaseRow = typeof assistanceCases.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type CrisisEvent = typeof crisisEvents.$inferSelect;

export type DestWithMission = Destination & { mission: Mission | null };
export type TripFull = Trip & { destinations: DestWithMission[] };

/** Result returned by server actions used with <ActionForm>. */
export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

export type RoutingEntry = {
  country: string;
  region: string | null;
  missionId: string;
  missionName: string;
  missionCity: string;
  missionCountry: string;
};
