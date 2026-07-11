export type AddState = 'adding' | 'added';

export type AiMessage = {
  id: string;
  role: 'user' | 'ai';
  kind: 'text';
  text: string;
  predictions?: import('@/lib/api/places').PlacePrediction[];
};
