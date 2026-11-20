/**
 * Utility functions for Gmail-style Nested Labels hierarchy.
 */

/**
 * Returns the full breadcrumb path of a label, e.g. "Work / Projects / Q1".
 * @param {Object} label - The label object { id, name, parentId }
 * @param {Array} allLabels - Array of all label objects
 * @returns {string} - Formatted hierarchical label path
 */
export const getFullLabelPath = (label, allLabels = []) => {
  if (!label || !label.name) return "";
  const labelMap = new Map((allLabels || []).map((l) => [String(l.id), l]));

  const parts = [label.name];
  let currentParentId = label.parentId;
  const visited = new Set([String(label.id)]);

  while (currentParentId != null && !visited.has(String(currentParentId))) {
    visited.add(String(currentParentId));
    const parent = labelMap.get(String(currentParentId));
    if (!parent) break;
    parts.unshift(parent.name);
    currentParentId = parent.parentId;
  }

  return parts.join(" / ");
};

/**
 * Returns a Set of string IDs of all descendants (children, grandchildren, etc.) of a label.
 * @param {string|number} labelId
 * @param {Array} allLabels
 * @returns {Set<string>}
 */
export const getDescendantLabelIds = (labelId, allLabels = []) => {
  const descendants = new Set();
  if (labelId == null) return descendants;

  const targetIdStr = String(labelId);
  const queue = [targetIdStr];

  while (queue.length > 0) {
    const currentId = queue.shift();
    (allLabels || []).forEach((l) => {
      if (l && l.parentId != null && String(l.parentId) === currentId) {
        const childIdStr = String(l.id);
        if (!descendants.has(childIdStr)) {
          descendants.add(childIdStr);
          queue.push(childIdStr);
        }
      }
    });
  }

  return descendants;
};

/**
 * Returns labels that can validly be chosen as a parent for the current label.
 * Excludes the label itself and all its descendants to strictly prevent circular loops.
 * @param {string|number|null} currentLabelId
 * @param {Array} allLabels
 * @returns {Array} Valid parent candidates
 */
export const getValidParentCandidates = (currentLabelId, allLabels = []) => {
  if (currentLabelId == null) return allLabels || [];
  const invalidIds = getDescendantLabelIds(currentLabelId, allLabels);
  invalidIds.add(String(currentLabelId));

  return (allLabels || []).filter((l) => l && !invalidIds.has(String(l.id)));
};

/**
 * Flattens labels into a hierarchical depth-annotated list for indented tables and selects.
 * @param {Array} allLabels
 * @returns {Array} List of labels with { ...label, depth }
 */
export const flattenLabelTree = (allLabels = []) => {
  if (!Array.isArray(allLabels) || allLabels.length === 0) return [];

  const result = [];
  const labelMap = new Map(allLabels.map((l) => [String(l.id), l]));

  // Find children for each parent
  const childrenMap = new Map();
  allLabels.forEach((lbl) => {
    const pId = lbl.parentId != null ? String(lbl.parentId) : "ROOT";
    if (!childrenMap.has(pId)) {
      childrenMap.set(pId, []);
    }
    childrenMap.get(pId).push(lbl);
  });

  const traverse = (parentId, depth) => {
    const children = childrenMap.get(parentId) || [];
    // Sort alphabetically by name
    children.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    children.forEach((child) => {
      result.push({
        ...child,
        depth,
        fullPath: getFullLabelPath(child, allLabels)
      });
      traverse(String(child.id), depth + 1);
    });
  };

  // Start with root labels (parentId is null or parent doesn't exist in map)
  const rootLabels = allLabels.filter(
    (l) => l.parentId == null || !labelMap.has(String(l.parentId))
  );
  rootLabels.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  rootLabels.forEach((root) => {
    result.push({
      ...root,
      depth: 0,
      fullPath: root.name
    });
    traverse(String(root.id), 1);
  });

  return result;
};
