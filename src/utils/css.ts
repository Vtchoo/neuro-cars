const unitlessProperties = new Set([
    'animationIterationCount',
    'aspectRatio',
    'borderImageOutset',
    'borderImageSlice',
    'borderImageWidth',
    'boxFlex',
    'boxFlexGroup',
    'boxOrdinalGroup',
    'columnCount',
    'columns',
    'flex',
    'flexGrow',
    'flexPositive',
    'flexShrink',
    'flexNegative',
    'flexOrder',
    'gridArea',
    'gridRow',
    'gridRowEnd',
    'gridRowSpan',
    'gridRowStart',
    'gridColumn',
    'gridColumnEnd',
    'gridColumnSpan',
    'gridColumnStart',
    'fontWeight',
    'lineClamp',
    'lineHeight',
    'opacity',
    'order',
    'orphans',
    'scale',
    'tabSize',
    'widows',
    'zIndex',
    'zoom',
]);

function hyphenateStyleName(name: string) {
    return name
        .replace(/([A-Z])/g, '-$1')
        .replace(/^ms-/, '-ms-') // special case like React
        .toLowerCase();
}

export function style(obj: { [key: string]: any }) {
    if (!obj || typeof obj !== 'object') return '';

    let result = '';

    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

        let value = obj[key];

        if (value == null || typeof value === 'boolean' || value === '') {
            continue;
        }

        const isCustomProperty = key.startsWith('--');
        const name = isCustomProperty ? key : hyphenateStyleName(key);

        if (
            typeof value === 'number' &&
            value !== 0 &&
            !unitlessProperties.has(key)
        ) {
            value = value + 'px';
        }

        result += `${name}:${String(value)};`;
    }

    return result;
}