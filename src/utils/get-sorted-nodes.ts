import { addComments, removeComments } from '@babel/types';
import { clone, isEqual } from 'lodash';

import {
    NEW_LINE_SPECIAL_WORD,
    THIRD_PARTY_MODULES_SPECIAL_WORD,
    newLineNode,
} from '../constants';
import { naturalSort } from '../natural-sort';
import { GetSortedNodes, ImportGroups, ImportOrLine } from '../types';
import { getImportNodesMatchedGroup } from './get-import-nodes-matched-group';
import { getSortedImportSpecifiers } from './get-sorted-import-specifiers';
import { getSortedNodesGroup } from './get-sorted-nodes-group';

/**
 * This function returns all the nodes which are in the importOrder array.
 * The plugin considered these import nodes as local import declarations.
 * @param nodes all import nodes
 * @param options
 */
export const getSortedNodes: GetSortedNodes = (nodes, options) => {
    naturalSort.insensitive = options.importOrderCaseInsensitive;

    let { importOrder } = options;
    const {
        importOrderSeparation,
        importOrderSortSpecifiers,
        importOrderGroupNamespaceSpecifiers,
    } = options;

    const originalNodes = nodes.map(clone);

    if (!importOrder.includes(THIRD_PARTY_MODULES_SPECIAL_WORD)) {
        importOrder.unshift(THIRD_PARTY_MODULES_SPECIAL_WORD);
    }

    const importOrderGroups = importOrder.reduce<ImportGroups>(
        (groups, regexp) => ({
            ...groups,
            [regexp]: [],
        }),
        {},
    );

    const importOrderWithOutThirdPartyPlaceholder = importOrder.filter(
        (group) =>
            group !== THIRD_PARTY_MODULES_SPECIAL_WORD &&
            group !== NEW_LINE_SPECIAL_WORD,
    );

    for (const node of originalNodes) {
        const matchedGroup = getImportNodesMatchedGroup(
            node,
            importOrderWithOutThirdPartyPlaceholder,
        );
        importOrderGroups[matchedGroup].push(node);
    }

    const finalNodes = importOrder
        .filter(
            (group) =>
                importOrderGroups[group].length ||
                group === NEW_LINE_SPECIAL_WORD,
        )
        .reduce<ImportOrLine[]>((acc, group, index) => {
            if (group === NEW_LINE_SPECIAL_WORD) {
                return [...acc, newLineNode];
            }
            const groupNodes = importOrderGroups[group];
            if (groupNodes.length === 0) {
                return acc;
            }
            const sortedInsideGroup = getSortedNodesGroup(groupNodes, {
                importOrderGroupNamespaceSpecifiers,
            });

            // Sort the import specifiers
            if (importOrderSortSpecifiers) {
                sortedInsideGroup.forEach((node) =>
                    getSortedImportSpecifiers(node),
                );
            }
            acc.push(...sortedInsideGroup);
            if (importOrderSeparation || index === importOrder.length - 1) {
                acc.push(newLineNode);
            }
            return acc;
        }, []);

    // maintain a copy of the nodes to extract comments from
    const finalNodesClone = finalNodes.map(clone);

    const firstNodesComments = nodes[0].leadingComments;

    // Remove all comments from sorted nodes
    finalNodes.forEach(removeComments);

    // insert comments other than the first comments
    finalNodes.forEach((node, index) => {
        if (isEqual(nodes[0].loc, node.loc)) return;

        addComments(
            node,
            'leading',
            finalNodesClone[index].leadingComments || [],
        );
    });

    if (firstNodesComments) {
        addComments(finalNodes[0], 'leading', firstNodesComments);
    }

    return finalNodes;
};
