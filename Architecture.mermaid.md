# Architecture

Converted from [Architecture.pdf](Architecture.pdf). Dashed arrows show event connections. The solid connector associates the answering engine with its resource enclosure. Stacked workers in the source are represented as multiple instances.

```mermaid
flowchart LR
    sns_receiver[["SNS Receiver<br/>Black box"]]
    sns_event[/"SNS event"/]
    receiver_lb{{"Load balancer"}}
    receiver_adapter["Receiver adapter<br/>Multiple instances"]
    new_event[/"New event<br/>message / confirm / any"/]
    event_bus[("Event bus")]

    sns_receiver -.-> sns_event
    sns_event -.-> receiver_lb
    receiver_lb -.-> receiver_adapter
    receiver_adapter -.-> new_event
    new_event -.-> event_bus

    answering_lb{{"Load balancer<br/>Consumer"}}
    answering_engine["Answering engine<br/>Multiple instances"]
    answer_event[/"Answer event"/]

    event_bus -.-> answering_lb
    answering_lb -.-> answering_engine
    answering_engine -.-> answer_event
    answer_event -.-> event_bus

    subgraph answering_resources["LLM / patterns / templates"]
        direction TB
        conversation_context[("Conversation context")]
        customer_rules[/"Customer rules"/]
        answer("Answer")
    end

    answering_engine --- answering_resources

    sender_lb{{"Load balancer<br/>Consumer"}}
    sender_adapter["Sender adapter<br/>Multiple instances"]
    sns_sender[["SNS Sender<br/>Black box"]]
    delivery_confirmation[/"Confirm delivery event<br/>if it exists"/]
    send_event[/"Send event"/]

    event_bus -.-> sender_lb
    sender_lb -.-> sender_adapter
    sender_adapter -.-> sns_sender
    sns_sender -.-> delivery_confirmation
    delivery_confirmation -.-> sns_receiver
    sender_adapter -.-> send_event
    send_event -.-> event_bus

    analytics_lb{{"Load balancer"}}
    analytics["Analytics<br/>Multiple instances"]
    inner[["Inner<br/>Graphna"]]
    outer[["Outer<br/>Ads / Marketing"]]

    event_bus -.-> analytics_lb
    analytics_lb -.-> analytics
    analytics -.-> inner
    analytics -.-> outer

    classDef balancer fill:#e5e5e5,stroke:#333,color:#111
    class receiver_lb,answering_lb,sender_lb,analytics_lb balancer
```

## Source annotations

| Component | Annotation |
| --- | --- |
| All four load balancers | "if messages count influent to system timeout"; "For example 1M". |
| Receiver adapter | `Idempotency key: recipient_id` and `timestamp` appear as separate highlighted lines. |
| Receiver adapter | Matcher, filter, converter. |
| Event bus | Technology labels: `kafka`, `postgres`, `rabbit`, `MtM dbs`. |
| Event bus | If message volume affects the system timeout, add parallel data handling. The source gives "1M" as an example. |
| Event bus | A separate downward arrow is labeled "event flow". It indicates direction, without connecting additional components. |

`MtM dbs` and `Graphna` are preserved as written in the source. The source does not specify a unit for "1M" or whether `timestamp` is part of the idempotency key. The answering enclosure contains no connections between its three internal elements.
