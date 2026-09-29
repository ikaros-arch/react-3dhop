export type AnnotationColor = [number, number, number];

export type AnnotationDefinition = {
	id?: string;
	label?: string;
	comment?: string;
	position: [number, number, number];
	type?: string;
	radius?: number;
	color?: AnnotationColor | string;
	alpha?: number;
	alphaHigh?: number;
	useTransparency?: boolean;
	useStencil?: boolean;
	tags?: string[];
};

export type AnnotationBuildResult = {
	spots?: Record<string, unknown>;
	map: Map<string, AnnotationDefinition>;
};

export const DEFAULT_ANNOTATION_COLOR: AnnotationColor = [1, 0.76, 0.04];
export const DEFAULT_ANNOTATION_RADIUS = 0.5;
export const DEFAULT_ANNOTATION_ALPHA = 0.5;
export const DEFAULT_ANNOTATION_ALPHA_HIGH = 0.8;

export function normalizeAnnotationColor(input: AnnotationDefinition['color']): AnnotationColor {
	if (!input) {
		return DEFAULT_ANNOTATION_COLOR;
	}

	const asArray = Array.isArray(input)
		? input
		: (() => {
				try {
					const parsed = JSON.parse(input);
					return Array.isArray(parsed) ? parsed : null;
				} catch (error) {
					return null;
				}
			})();

	if (!asArray || asArray.length < 3) {
		return DEFAULT_ANNOTATION_COLOR;
	}

	const safe = (value: unknown, fallback: number): number => {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? numeric : fallback;
	};

	return [
		safe(asArray[0], DEFAULT_ANNOTATION_COLOR[0]),
		safe(asArray[1], DEFAULT_ANNOTATION_COLOR[1]),
		safe(asArray[2], DEFAULT_ANNOTATION_COLOR[2])
	];
}

export function normalizeAnnotationRadius(value: AnnotationDefinition['radius']): number {
	if (typeof value !== 'number') {
		return DEFAULT_ANNOTATION_RADIUS;
	}
	const positive = Number.isFinite(value) ? value : DEFAULT_ANNOTATION_RADIUS;
	return positive > 0 ? positive : DEFAULT_ANNOTATION_RADIUS;
}

export function buildAnnotations(
	annotations: AnnotationDefinition[] | undefined,
	options: { idPrefix?: string; meshName: string }
): AnnotationBuildResult {
	const { idPrefix = 'annotation', meshName } = options;
	const map = new Map<string, AnnotationDefinition>();
	const spots: Record<string, unknown> = {};

	if (!annotations || annotations.length === 0) {
		return {
			spots: undefined,
			map
		};
	}

	annotations.forEach((annotationEntry, index) => {
		if (!annotationEntry || !Array.isArray(annotationEntry.position) || annotationEntry.position.length < 3) {
			return;
		}

		const id = annotationEntry.id ?? `${idPrefix}_${index + 1}`;
		map.set(id, annotationEntry);

		const radius = normalizeAnnotationRadius(annotationEntry.radius);
		const [x, y, z] = annotationEntry.position;
		const tags = annotationEntry.tags ?? (annotationEntry.type ? [annotationEntry.type] : undefined);

		spots[id] = {
			mesh: meshName,
			color: normalizeAnnotationColor(annotationEntry.color),
			alpha: typeof annotationEntry.alpha === 'number' ? annotationEntry.alpha : DEFAULT_ANNOTATION_ALPHA,
			alphaHigh: typeof annotationEntry.alphaHigh === 'number' ? annotationEntry.alphaHigh : DEFAULT_ANNOTATION_ALPHA_HIGH,
			useTransparency: annotationEntry.useTransparency ?? true,
			useStencil: annotationEntry.useStencil ?? true,
			tags,
			transform: {
				translation: [x, y, z],
				scale: [radius, radius, radius]
			}
		};
	});

	return {
		spots: Object.keys(spots).length > 0 ? spots : undefined,
		map
	};
}
