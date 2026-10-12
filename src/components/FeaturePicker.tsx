import { useEffect, useId, useRef, useState } from 'react';
import type { DragEvent, FocusEvent, KeyboardEvent, PointerEvent } from 'react';
import { Check, Plus, X } from 'lucide-react';
import type { Feature } from '../shared/types';
import './FeaturePicker.css';

export interface FeaturePickerProps {
  value: Feature[];
  onChange: (features: Feature[]) => void;
  disabled?: boolean;
}
