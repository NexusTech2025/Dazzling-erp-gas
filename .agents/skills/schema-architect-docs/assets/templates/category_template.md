# {{ Category Name }} Category

## 1. Purpose of the Category
[Explain why this domain exists, its business responsibilities, and system boundaries.]

## 2. Domain Responsibilities
| Responsibility | Included (Yes/No/Partial) |
| --- | --- |
| [e.g., Student Identity] | [Yes] |
| [e.g., Authentication] | [No] |

## 3. Domain Workflow Narrative
[Explain actual operational flows. This is CRITICAL. Example: Student Created -> Address Attached -> ...]

## 4. Entity Relationship Overview
[Include relationship explanations, ownership rules, and dependency direction among tables in this category.]

### Category ER Diagram
```mermaid
erDiagram
    %% Mermaid ER code here
```

## 5. Design Decisions
[Explain WHY certain tables or relations exist this way. (e.g., "ContactInfo was separated from Student to allow future extensibility")]

## 6. Future Evolution Notes
[Notes on possible future additions and schema growth. VERY IMPORTANT.]

## 7. Governance Alignment
- **Soft-Delete**: All entities in this category follow the `__deleted_at` protocol.
- **Transactions**: Workflows in this category utilize the `__tx_id` for atomic operations.
- **Naming**: All tables follow the `snake_case` plural convention.
